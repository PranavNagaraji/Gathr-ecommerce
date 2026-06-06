import 'dotenv/config'; // Reload: sender email updated to gmail
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import { Clerk } from "@clerk/clerk-sdk-node";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import supabase from "./db.js";
import pg from "pg";
import merchantRoutes from "./routes/merchantRoute.js";
import customerRoutes from "./routes/customerRoute.js";
import orderRoutes from "./routes/orderRoute.js";
import razorpayRoutes from "./razorpayIntegration.js";
import deliveryRoutes from "./routes/deliveryRoute.js";
import notifyRoutes from "./routes/notifyRoute.js";
import complaintsRoutes from "./routes/complaintsRoute.js";
import adminRoutes from "./routes/adminRoute.js";
import otpRouter from "./routes/otpRoute.js";

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

const app = express();
const server = http.createServer(app);

//cors policy security check
const allowedOrigins = ["https://gathr-se.vercel.app", "http://localhost:3000"];
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
  // client will join order-specific room
  socket.on("room:join", ({ orderId, role, name }) => {
    if (!orderId) return;
    const room = `order:${orderId}`;
    socket.join(room);
    io.to(room).emit("system:joined", { who: role || "user", name: name || "", ts: Date.now() });
  });

  // carrier pushes location; broadcast to room
  socket.on("location:update", ({ orderId, lat, long }) => {
    if (!orderId || lat == null || long == null) return;
    const room = `order:${orderId}`;
    io.to(room).emit("location:update", { lat: Number(lat), long: Number(long), ts: Date.now() });
  });

  // chat messages (no persistence)
  socket.on("chat:message", ({ orderId, from, text, name }) => {
    if (!orderId || !text) return;
    const room = `order:${orderId}`;
    // send to everyone EXCEPT the sender to avoid duplicates on sender
    socket.to(room).emit("chat:message", { from: from || "user", text, name: name || "", ts: Date.now() });
  });
});

// Razorpay webhook route
app.post("/razorpay/webhook", express.json(), async (req, res, next) => {
  req.url = '/webhook';
  razorpayRoutes(req, res, next);
});

// Now apply JSON parser for all other routes
app.use(express.json({ limit: "50mb"}));
app.use(express.urlencoded({ extended: true , limit: '50mb'}));

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

async function ensureWishlistSchema() {
  const { SUPABASE_DB_URL } = process.env;
  if (!SUPABASE_DB_URL) {
    console.warn("[ensureWishlistSchema] SUPABASE_DB_URL not set; skipping migration");
    return;
  }
  const pool = new pg.Pool({ connectionString: SUPABASE_DB_URL, max: 1 });
  const sql = `
  create table if not exists public.wishlist (
    id bigserial primary key,
    user_clerk_id text not null,
    item_id bigint not null references public."Items"(id) on delete cascade,
    shop_id bigint not null references public."Shops"(id) on delete cascade,
    created_at timestamptz default now(),
    unique (user_clerk_id, item_id)
  );
  alter table public.wishlist disable row level security;`;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    // console.log('[ensureWishlistSchema] wishlist schema ensured');
  } catch (e) {
    await client.query('rollback');
    console.error('[ensureWishlistSchema] migration failed:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureComplaintsSchema() {
  const { SUPABASE_DB_URL } = process.env;
  if (!SUPABASE_DB_URL) {
    console.warn("[ensureComplaintsSchema] SUPABASE_DB_URL not set; skipping migration");
    return;
  }
  const pool = new pg.Pool({ connectionString: SUPABASE_DB_URL, max: 1 });
  const sql = `
  create table if not exists public."Complaints" (
    id bigserial primary key,
    user_clerk_id text,
    name text,
    email text,
    message text not null,
    status text default 'open',
    created_at timestamptz default now()
  );
  alter table public."Complaints" disable row level security;`;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('[ensureComplaintsSchema] Complaints schema ensured');
  } catch (e) {
    await client.query('rollback');
    console.error('[ensureComplaintsSchema] migration failed:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

ensureWishlistSchema();
ensureComplaintsSchema();

server.listen(5000, () => console.log("Backend + Socket.IO running on http://localhost:5000"));