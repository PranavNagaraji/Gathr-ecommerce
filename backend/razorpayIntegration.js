// Complete Razorpay Payment Integration - All-in-One Backend File
import express from "express";
import Razorpay from "razorpay";
import supabase from "./db.js";
import { Clerk } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Initialize Razorpay with key_id and key_secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const FRONTEND_URL = process.env.FRONTEND_URL;

// Helper Functions
async function getUserByClerkId(clerkId) {
  const { data: user, error } = await supabase
    .from("Users")
    .select("id, role")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !user) return null;
  return user;
}

async function getOrderById(orderId) {
  const { data: order, error: orderError } = await supabase
    .from("Orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("Failed to get order:", orderId, "Error:", orderError);
    return null;
  }

  const { data: cartItems, error: cartItemsError } = await supabase
    .from("Cart_items")
    .select("*, Items(*)")
    .eq("cart_id", order.cart_id);

  if (cartItemsError) {
    console.error("Failed to get cart items for order:", orderId, "Error:", cartItemsError);
    return null;
  }

  return {
    ...order,
    items: cartItems?.map(item => ({
      id: item.Items.id,
      name: item.Items.name,
      description: item.Items.description,
      price: item.Items.price,
      quantity: item.quantity
    })) || []
  };
}

// Payment Controllers
async function createOrderFromCartHandler(req, res) {
  try {
    const { clerkId, addressId } = req.body;

    if (!clerkId || !addressId) {
      return res.status(400).json({ error: "clerkId and addressId are required" });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "customer") {
      return res.status(403).json({ error: "Only customers can create orders" });
    }

    const { data: cart, error: cartError } = await supabase
      .from("Cart")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (cartError || !cart) {
      return res.status(404).json({ error: "No active cart found" });
    }

    const { data: cartItems, error: itemsError } = await supabase
      .from("Cart_items")
      .select("*, Items(*)")
      .eq("cart_id", cart.id);

    if (itemsError || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty or failed to load" });
    }

    const shopId = cartItems[0].Items?.shop_id;
    const subtotal = cartItems.reduce((sum, item) => {
      const itemPrice = item.Items?.price || 0;
      const itemQty = item.quantity || 0;
      return sum + (itemPrice * itemQty);
    }, 0);

    const { data: address, error: addressError } = await supabase
      .from("Addresses")
      .select("*")
      .eq("id", addressId)
      .eq("user_id", user.id)
      .single();

    if (addressError || !address) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const { data: shop, error: shopError } = await supabase
      .from("Shops")
      .select("id, Location")
      .eq("id", shopId)
      .single();
    if (shopError || !shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    const toRad = (v) => (v * Math.PI) / 180;
    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const shopLat = shop?.Location?.latitude ?? shop?.Location?.lat;
    const shopLong = shop?.Location?.longitude ?? shop?.Location?.long;
    const destLat = address?.location?.lat ?? address?.location?.latitude;
    const destLong = address?.location?.long ?? address?.location?.longitude;
    if ([shopLat, shopLong, destLat, destLong].some(v => v == null)) {
      return res.status(400).json({ error: "Missing coordinates for delivery computation" });
    }
    const distanceKm = getDistanceKm(Number(shopLat), Number(shopLong), Number(destLat), Number(destLong));

    const GST_RATE = parseFloat(process.env.GST_RATE || '0.18');
    const DELIVERY_BASE_KM = parseFloat(process.env.DELIVERY_BASE_KM || '2');
    const DELIVERY_BASE_FEE = parseFloat(process.env.DELIVERY_BASE_FEE || '30');
    const DELIVERY_PER_KM_FEE = parseFloat(process.env.DELIVERY_PER_KM_FEE || '10');

    const extraKm = Math.max(0, distanceKm - DELIVERY_BASE_KM);
    const deliveryFee = DELIVERY_BASE_FEE + Math.ceil(extraKm) * DELIVERY_PER_KM_FEE;
    const gst = subtotal * GST_RATE;
    const totalAmount = subtotal + gst + deliveryFee;

    const { data: order, error: orderError } = await supabase
      .from("Orders")
      .insert({
        customer_id: user.id,
        shop_id: shopId,
        cart_id: cart.id,
        address_id: addressId,
        amount_paid: totalAmount,
        payment_status: "pending",
        payment_method: "razorpay"
      })
      .select()
      .single();

    if (orderError) {
      return res.status(500).json({ error: "Failed to create order" });
    }

    await supabase
      .from("Cart_items")
      .update({ order_id: order.id })
      .eq("cart_id", cart.id);

    await supabase
      .from("Cart")
      .update({ status: "completed" })
      .eq("id", cart.id);

    return res.json({ order });
  } catch (error) {
    console.error("Error creating order from cart:", error);
    return res.status(500).json({ error: "Internal error" });
  }
}

async function createRazorpayOrderHandler(req, res) {
  try {
    const { orderId, clerkId } = req.body;

    if (!orderId || !clerkId) {
      return res.status(400).json({ error: "orderId and clerkId are required" });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.customer_id !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const options = {
      amount: Math.round(order.amount_paid * 100), // in paise
      currency: "INR",
      receipt: `receipt_order_${order.id}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Update order with Razorpay order ID (stored in stripe_session_id to avoid schema change)
    await supabase
      .from("Orders")
      .update({
        stripe_session_id: razorpayOrder.id,
        payment_status: "pending"
      })
      .eq("id", orderId);

    return res.json({
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "Gathr",
      description: `Payment for Order #${order.id}`,
      order_id: razorpayOrder.id,
      orderDbId: order.id
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({ error: "Failed to create payment order", details: error.message });
  }
}

async function verifyPaymentHandler(req, res) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, clerkId } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !clerkId) {
      return res.status(400).json({ error: "Missing required validation parameters" });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Signature verification failed" });
    }

    // Get order and update details
    const { data: order, error: fetchErr } = await supabase
      .from("Orders")
      .select("*")
      .eq("stripe_session_id", razorpay_order_id)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await supabase
      .from("Orders")
      .update({
        payment_status: "paid",
        amount_paid: order.amount_paid,
        stripe_payment_intent_id: razorpay_payment_id
      })
      .eq("id", order.id);

    return res.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ error: "Verification failed", details: error.message });
  }
}

async function getPaymentStatusHandler(req, res) {
  try {
    const { sessionId, clerkId } = req.body;

    if (!sessionId || !clerkId) {
      return res.status(400).json({ error: "sessionId and clerkId are required" });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data: order, error } = await supabase
      .from("Orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: "Order not found for this session" });
    }

    if (order.customer_id !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      orderId: order.id,
      paymentStatus: order.payment_status,
      stripeSessionId: order.stripe_session_id,
      amountPaid: order.amount_paid,
      stripePaymentIntentId: order.stripe_payment_intent_id
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    return res.status(500).json({ error: "Failed to get payment status", details: error.message });
  }
}

async function handleWebhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    if (!signature) {
      return res.status(400).send("Missing signature");
    }

    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;
    console.log("Razorpay Webhook event received:", event.event);

    if (event.event === "order.paid") {
      const paymentPayload = event.payload.payment.entity;
      const orderPayload = event.payload.order.entity;

      await supabase
        .from("Orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentPayload.id
        })
        .eq("stripe_session_id", orderPayload.id);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}

async function refundHandler(req, res) {
  try {
    const { orderId, clerkId, amount } = req.body;

    if (!orderId || !clerkId) {
      return res.status(400).json({ error: "orderId and clerkId are required" });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "merchant") {
      return res.status(403).json({ error: "Only merchants can process refunds" });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.payment_status !== "paid") {
      return res.status(400).json({ error: "Can only refund paid orders" });
    }

    if (!order.stripe_payment_intent_id) {
      return res.status(400).json({ error: "No payment ID found for this order" });
    }

    // Call Razorpay Refunds API
    const refundOptions = {
      payment_id: order.stripe_payment_intent_id,
    };
    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // in paise
    }

    const refund = await razorpay.payments.refund(order.stripe_payment_intent_id, refundOptions);

    await supabase
      .from("Orders")
      .update({
        payment_status: "refunded",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    return res.json({
      message: "Refund processed successfully",
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        created_at: refund.created_at
      }
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return res.status(500).json({ error: "Failed to process refund", details: error.message });
  }
}

const router = express.Router();

router.post("/create-order-from-cart", createOrderFromCartHandler);
router.post("/create-checkout-session", createRazorpayOrderHandler);
router.post("/verify-payment", verifyPaymentHandler);
router.post("/payment-status", getPaymentStatusHandler);
router.post("/webhook", handleWebhook);
router.post("/refund", refundHandler);

export default router;
