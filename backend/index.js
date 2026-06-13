import 'dotenv/config'; // Reload: sender email updated to gmail
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createIndex } from './redis/redisIndex.js';
import { seedFromSupabase } from './redis/redisSeed.js';
import { Clerk } from "@clerk/clerk-sdk-node";
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
// Razorpay webhook route
app.post("/razorpay/webhook", express.json(), async (req, res, next) => {
  req.url = '/webhook';
  razorpayRoutes(req, res, next);
});

// Now apply JSON parser for all other routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public routes (no Clerk auth)
app.use("/api/otp", otpRouter);

// Protected routes (Clerk auth required)
app.use(clerkMiddleware());

//routes
app.use("/api/merchant", merchantRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/order", orderRoutes);
app.use("/razorpay", razorpayRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/notify", notifyRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/admin", adminRoutes);
//test route
app.get("/", (req, res) => res.send("Hello from backend!"));

app.post("/set-role", async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ message: "Missing userId or role" });
  }

  try {
    console.log("Setting role for user", userId, "to", role);

    // Set role in Clerk's metadata
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });

    const user = await clerk.users.getUser(userId);
    console.log("User info from Clerk:", user);

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
          first_name: user.firstName,
          last_name: user.lastName,
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