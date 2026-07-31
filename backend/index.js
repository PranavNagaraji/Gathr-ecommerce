import 'dotenv/config'; // Reload: sender email updated to gmail
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createIndex } from './redis/redisIndex.js';
import { seedFromSupabase } from './redis/redisSeed.js';
import { Clerk } from "@clerk/clerk-sdk-node";
import { Webhook } from "svix";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import supabase from "./db.js";
import merchantRoutes from "./routes/merchantRoute.js";
import customerRoutes from "./routes/customerRoute.js";
import orderRoutes from "./routes/orderRoute.js";
import razorpayRoutes from "./razorpayIntegration.js";
import deliveryRoutes from "./routes/deliveryRoute.js";
import notifyRoutes from "./routes/notifyRoute.js";
import complaintsRoutes from "./routes/complaintsRoute.js";
import adminRoutes from "./routes/adminRoute.js";
import otpRouter from "./routes/otpRoute.js";
import redisClient from "./redis/redis.js";

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

const app = express();
const server = http.createServer(app);

//cors policy security check
const allowedOrigins = ["https://gathr-ecommerce.vercel.app", "http://localhost:3000"];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Socket.IO server with same CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // carrier pushes location; broadcast to room
  socket.on("location:update", ({ orderId, lat, long }) => {
    if (!orderId || lat == null || long == null) return;
    const room = `order:${orderId}`;
    io.to(room).emit("location:update", { lat: Number(lat), long: Number(long), ts: Date.now() });
  });

  // chat messages (persistence via Redis)
  socket.on("room:join", ({ orderId, role, name }) => {
    if (!orderId) return;
    const room = `order:${orderId}`;
    socket.join(room);
    io.to(room).emit("system:joined", { who: role || "user", name: name || "", ts: Date.now() });
    redisClient.lRange(`chat:${orderId}`, 0, -1).then((msgs) => {
      const history = msgs.map(m => JSON.parse(m));
      socket.emit("chat:history", history);
    }).catch(() => { });
  });
  socket.on("chat:message", ({ orderId, from, text, name }) => {
    if (!orderId || !text) return;
    const room = `order:${orderId}`;
    // send to everyone EXCEPT the sender to avoid duplicates on sender
    const msg = { from: from || "user", text, name: name || "", ts: Date.now() };
    redisClient.rPush(`chat:${orderId}`, JSON.stringify(msg))
      .then(() => redisClient.lTrim(`chat:${orderId}`, -200, -1))
      .then(() => redisClient.expire(`chat:${orderId}`, 60 * 60 * 24 * 7))
      .catch(() => { });
    socket.to(room).emit("chat:message", msg);
  });
});

// Razorpay webhook route (needs raw or unparsed before express.json)
app.post("/razorpay/webhook", express.json(), async (req, res, next) => {
  req.url = '/webhook';
  razorpayRoutes(req, res, next);
});

// Clerk Webhook route (MUST use express.raw for svix signature verification BEFORE express.json & clerkMiddleware)
app.post("/api/webhooks/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return res.status(500).json({ error: "CLERK_WEBHOOK_SECRET not configured on server" });
  }

  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.warn("Clerk webhook missing svix verification headers");
    return res.status(400).json({ error: "Missing svix headers" });
  }

  let evt;
  try {
    const payloadStr = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(payloadStr, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Clerk webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const { type, data } = evt;
  console.log(`Processing Clerk webhook event: ${type}`);

  if (type === "user.created" || type === "user.updated") {
    const { id, email_addresses, first_name, last_name, unsafe_metadata, public_metadata } = data;
    const primaryEmailObj = email_addresses?.find((e) => e.id === data.primary_email_address_id) || email_addresses?.[0];
    const email = primaryEmailObj?.email_address;
    const role = unsafe_metadata?.intended_role || public_metadata?.role || "customer";

    if (!email) {
      console.warn("Clerk webhook user event has no email address for user ID:", id);
      return res.status(400).json({ error: "User email missing" });
    }

    try {
      const { data: upsertedUser, error: dbError } = await supabase
        .from("Users")
        .upsert(
          {
            clerk_id: id,
            email,
            role,
            first_name: first_name || "",
            last_name: last_name || "",
          },
          { onConflict: "clerk_id" }
        )
        .select();

      if (dbError) {
        console.error("Supabase error during webhook user upsert:", dbError);
        return res.status(500).json({ error: "Database upsert failed" });
      }

      if (!public_metadata?.role) {
        await clerk.users.updateUserMetadata(id, {
          publicMetadata: { role },
        });
      }

      console.log(`Clerk user ${id} (${email}) synced to Supabase with role: ${role}`);
      return res.status(200).json({ success: true, user: upsertedUser });
    } catch (err) {
      console.error("Error processing Clerk user webhook:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(200).json({ received: true });
});

// Apply standard JSON parser for all other routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public routes (no Clerk auth)
app.use("/api/otp", otpRouter);

// Protected routes (Clerk auth required)
app.use(clerkMiddleware());

// Fallback User Sync Middleware to protect against missed/delayed webhooks
app.use(async (req, res, next) => {
  try {
    const auth = req.auth;
    const userId = auth?.userId;
    if (userId) {
      const { data: existingUser } = await supabase
        .from("Users")
        .select("id")
        .eq("clerk_id", userId)
        .maybeSingle();

      if (!existingUser) {
        console.log(`[Fallback Sync] User ${userId} not found in Supabase Users table. Creating row now...`);
        const clerkUser = await clerk.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        const role = clerkUser.publicMetadata?.role || clerkUser.unsafeMetadata?.intended_role || "customer";

        if (email) {
          await supabase.from("Users").upsert(
            {
              clerk_id: userId,
              email,
              role,
              first_name: clerkUser.firstName || "",
              last_name: clerkUser.lastName || "",
            },
            { onConflict: "clerk_id" }
          );

          if (!clerkUser.publicMetadata?.role) {
            await clerk.users.updateUserMetadata(userId, {
              publicMetadata: { role },
            });
          }
          console.log(`[Fallback Sync] Successfully created Supabase row for ${userId} with role ${role}`);
        }
      }
    }
  } catch (err) {
    console.error("Fallback user sync middleware error:", err.message);
  }
  next();
});

// Routes
app.use("/api/merchant", merchantRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/order", orderRoutes);
app.use("/razorpay", razorpayRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/admin", adminRoutes);

// Test route
app.get("/", (req, res) => res.send("Hello from backend!"));

app.post("/set-role", async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ message: "Missing userId or role" });
  }

  try {
    console.log("Setting role for user", userId, "to", role);

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });

    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return res.status(400).json({ message: "User email not found in Clerk" });
    }

    const { data, error } = await supabase
      .from("Users")
      .upsert(
        {
          clerk_id: user.id,
          email,
          role,
          first_name: user.firstName || "",
          last_name: user.lastName || "",
        },
        {
          onConflict: "clerk_id",
        }
      )
      .select();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      message: "Role set and user data synced to Supabase successfully.",
      user: data,
    });
  } catch (error) {
    console.error("Error in /set-role endpoint:", error);
    const errorMessage = error.errors?.[0]?.message || error.message || "An unknown error occurred.";
    return res.status(500).json({ message: errorMessage, error });
  }
});

const port = process.env.PORT || 5000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Backend + Socket.IO running on ${port}`);
});

// Non-blocking — won't delay startup
createIndex()
  .then(() => seedFromSupabase())
  .catch(err => console.error("Redis init failed:", err));