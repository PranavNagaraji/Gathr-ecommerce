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
// Helper to create the Supabase Order after successful payment
async function createOrderAfterPayment({ clerkId, addressId, cartId, razorpayOrderId, razorpayPaymentId }) {
  // 1. Check if order already exists with this razorpayOrderId (idempotency check)
  const { data: existingOrder } = await supabase
    .from("Orders")
    .select("id")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (existingOrder) {
    console.log("Order already exists for Razorpay Order ID:", razorpayOrderId);
    await supabase
      .from("Orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: razorpayPaymentId
      })
      .eq("id", existingOrder.id);
    return existingOrder;
  }

  // 2. Fetch user
  const user = await getUserByClerkId(clerkId);
  if (!user) throw new Error("User not found");

  // 3. Fetch Cart and Cart items
  const { data: cartItems, error: itemsError } = await supabase
    .from("Cart_items")
    .select("*, Items(*)")
    .eq("cart_id", cartId)
    .is("order_id", null);

  if (itemsError || !cartItems || cartItems.length === 0) {
    throw new Error("Cart items not found or already processed");
  }

  const shopId = cartItems[0].Items?.shop_id;
  const subtotal = cartItems.reduce((sum, item) => sum + (item.Items?.price || 0) * item.quantity, 0);

  // 4. Fetch address
  const { data: address } = await supabase
    .from("Addresses")
    .select("*")
    .eq("id", addressId)
    .single();

  if (!address) throw new Error("Address not found");

  // 5. Fetch shop
  const { data: shop } = await supabase
    .from("Shops")
    .select("id, Location")
    .eq("id", shopId)
    .single();

  if (!shop) throw new Error("Shop not found");

  // 6. Calculate distance and fees
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

  let distanceKm = 0;
  if ([shopLat, shopLong, destLat, destLong].every(v => v != null)) {
    distanceKm = getDistanceKm(Number(shopLat), Number(shopLong), Number(destLat), Number(destLong));
  }

  const GST_RATE = parseFloat(process.env.GST_RATE || '0.18');
  const DELIVERY_BASE_KM = parseFloat(process.env.DELIVERY_BASE_KM || '2');
  const DELIVERY_BASE_FEE = parseFloat(process.env.DELIVERY_BASE_FEE || '30');
  const DELIVERY_PER_KM_FEE = parseFloat(process.env.DELIVERY_PER_KM_FEE || '10');

  const extraKm = Math.max(0, distanceKm - DELIVERY_BASE_KM);
  const deliveryFee = DELIVERY_BASE_FEE + Math.ceil(extraKm) * DELIVERY_PER_KM_FEE;
  const gst = subtotal * GST_RATE;
  const totalAmount = subtotal + gst + deliveryFee;

  // 7. Insert Order
  const { data: order, error: orderError } = await supabase
    .from("Orders")
    .insert({
      customer_id: user.id,
      shop_id: shopId,
      cart_id: cartId,
      address_id: addressId,
      amount_paid: totalAmount,
      payment_status: "paid",
      payment_method: "razorpay",
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // 8. Associate cart items with order
  await supabase
    .from("Cart_items")
    .update({ order_id: order.id })
    .eq("cart_id", cartId)
    .is("order_id", null);

  // 9. Update sold quantities
  await Promise.all(
    cartItems.map(async ({ item_id, quantity }) => {
      const { data: item } = await supabase
        .from("Items")
        .select("sold_qt")
        .eq("id", item_id)
        .single();
      const currentSold = item?.sold_qt || 0;
      return supabase
        .from("Items")
        .update({ sold_qt: currentSold + quantity })
        .eq("id", item_id);
    })
  );

  // 10. Deactivate Cart
  await supabase
    .from("Cart")
    .update({ status: "inactive" })
    .eq("id", cartId);

  return order;
}

// Payment Controllers
async function createOrderFromCartHandler(req, res) {
  // Legacy stub, no longer needed but kept to prevent routing issues
  return res.status(410).json({ error: "Deprecated endpoint. Use /create-checkout-session directly." });
}

async function createRazorpayOrderHandler(req, res) {
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
      .eq("cart_id", cart.id)
      .is("order_id", null);

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
    if (distanceKm > 18.0) {
      return res.status(400).json({ error: `Delivery address is too far (${distanceKm.toFixed(1)} km) from the shop. Maximum delivery distance is 18 km. Please choose a nearby address.` });
    }

    const GST_RATE = parseFloat(process.env.GST_RATE || '0.18');
    const DELIVERY_BASE_KM = parseFloat(process.env.DELIVERY_BASE_KM || '2');
    const DELIVERY_BASE_FEE = parseFloat(process.env.DELIVERY_BASE_FEE || '30');
    const DELIVERY_PER_KM_FEE = parseFloat(process.env.DELIVERY_PER_KM_FEE || '10');

    const extraKm = Math.max(0, distanceKm - DELIVERY_BASE_KM);
    const deliveryFee = DELIVERY_BASE_FEE + Math.ceil(extraKm) * DELIVERY_PER_KM_FEE;
    const gst = subtotal * GST_RATE;
    const totalAmount = subtotal + gst + deliveryFee;

    const options = {
      amount: Math.round(totalAmount * 100), // in paise
      currency: "INR",
      receipt: `receipt_cart_${cart.id}`,
      notes: {
        clerkId: clerkId,
        addressId: String(addressId),
        cartId: String(cart.id)
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    return res.json({
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "Gathr",
      description: `Payment for Cart #${cart.id}`,
      order_id: razorpayOrder.id
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({ error: "Failed to create payment order", details: error.message });
  }
}

async function verifyPaymentHandler(req, res) {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, clerkId, addressId, cartId } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !clerkId) {
      return res.status(400).json({ error: "Missing required validation parameters" });
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Signature verification failed" });
    }

    // Resolve notes metadata if missing from request body
    let resolvedClerkId = clerkId;
    let resolvedAddressId = addressId;
    let resolvedCartId = cartId;

    if (!resolvedAddressId || !resolvedCartId) {
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      resolvedClerkId = rzpOrder.notes?.clerkId || clerkId;
      resolvedAddressId = rzpOrder.notes?.addressId;
      resolvedCartId = rzpOrder.notes?.cartId;
    }

    const order = await createOrderAfterPayment({
      clerkId: resolvedClerkId,
      addressId: resolvedAddressId,
      cartId: resolvedCartId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });

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
      .eq("razorpay_order_id", sessionId)
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
      razorpayOrderId: order.razorpay_order_id,
      amountPaid: order.amount_paid,
      razorpayPaymentId: order.razorpay_payment_id
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

      const clerkId = orderPayload.notes?.clerkId;
      const addressId = orderPayload.notes?.addressId;
      const cartId = orderPayload.notes?.cartId;

      if (clerkId && addressId && cartId) {
        await createOrderAfterPayment({
          clerkId,
          addressId,
          cartId,
          razorpayOrderId: orderPayload.id,
          razorpayPaymentId: paymentPayload.id
        });
      }
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

    if (!order.razorpay_payment_id) {
      return res.status(400).json({ error: "No payment ID found for this order" });
    }

    // Call Razorpay Refunds API
    const refundOptions = {
      payment_id: order.razorpay_payment_id,
    };
    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // in paise
    }

    const refund = await razorpay.payments.refund(order.razorpay_payment_id, refundOptions);

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
