import express from "express";
import requireAuth from "../utils/check.js";
import dotenv from "dotenv";
import supabase from "../db.js";
import { sendEmail } from "../utils/mailer.js";
dotenv.config();

const router = express.Router();

const otpStore = new Map();

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

function formatCurrency(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

async function fetchOrderDetails(orderId) {
  if (!orderId) return null;
  const { data: order, error } = await supabase
    .from("Orders")
    .select(`
      id, amount_paid, payment_method,
      Shops(id, shop_name, address, Location),
      Addresses(id, address, mobile_no, location),
      Users:customer_id(id, first_name, last_name, email),
      carrier:carrier_id(id, first_name, last_name, delivery_details),
      Cart(id, Cart_items(id, quantity, Items(id, name, price)))
    `)
    .eq("id", orderId)
    .single();

  if (error || !order) {
    console.warn("⚠️  Could not fetch order details for email:", error?.message);
    return null;
  }
  return order;
}

function buildOtpEmailHtml(otp, orderDetails) {
  if (!orderDetails) {
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="margin:0 0 8px">Delivery Verification</h2>
        <p style="margin:0 0 16px">Your verification code is:</p>
        <div style="background:#f4f4f4;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px">
          <span style="font-size:32px;letter-spacing:6px;font-weight:700">${otp}</span>
        </div>
        <p style="color:#666;font-size:13px">This code will expire in 5 minutes.</p>
      </div>`;
  }

  const shop = orderDetails.Shops;
  const address = orderDetails.Addresses;
  const customer = orderDetails.Users;
  const carrier = orderDetails.carrier;
  const items = orderDetails.Cart?.Cart_items || [];
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Valued Customer";
  const carrierName = carrier ? [carrier.first_name, carrier.last_name].filter(Boolean).join(" ") : "";
  const carrierPhone = carrier?.delivery_details?.phone || "";

  const itemsHtml = items.length > 0 ? `
    <table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">
      <thead>
        <tr>
          <th style="text-align:left;padding:4px 6px;border:1px solid #eee">Item</th>
          <th style="text-align:left;padding:4px 6px;border:1px solid #eee">Qty</th>
          <th style="text-align:left;padding:4px 6px;border:1px solid #eee">Price</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(ci => `
          <tr>
            <td style="padding:4px 6px;border:1px solid #eee">${ci.Items?.name || "Item"}</td>
            <td style="padding:4px 6px;border:1px solid #eee">${ci.quantity}</td>
            <td style="padding:4px 6px;border:1px solid #eee">${formatCurrency(ci.Items?.price || 0)}</td>
          </tr>`).join("")}
      </tbody>
    </table>` : "";

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111">
      <h2 style="margin:0 0 4px">Delivery Verification</h2>
      <p style="margin:0 0 16px;color:#444">Hi ${customerName}, your delivery is on its way!</p>

      <div style="background:#f4f4f4;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px">
        <p style="margin:0 0 4px;font-size:13px;color:#555">Your OTP Code</p>
        <span style="font-size:32px;letter-spacing:6px;font-weight:700">${otp}</span>
        <p style="margin:8px 0 0;font-size:12px;color:#999">Valid for 5 minutes</p>
      </div>

      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin:0 0 12px">
        <h3 style="margin:0 0 6px;font-size:14px">Order #${orderDetails.id}</h3>
        ${itemsHtml}
        <p style="margin:8px 0 0;font-size:14px;font-weight:600">Total: ${formatCurrency(orderDetails.amount_paid)}</p>
      </div>

      ${shop ? `
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin:0 0 12px">
        <h3 style="margin:0 0 4px;font-size:14px">Shop</h3>
        <p style="margin:0;font-size:13px;color:#444">${shop.shop_name || "Shop"}</p>
        ${shop.address ? `<p style="margin:2px 0 0;font-size:12px;color:#777">${shop.address}</p>` : ""}
      </div>` : ""}

      ${address ? `
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin:0 0 12px">
        <h3 style="margin:0 0 4px;font-size:14px">Delivery Address</h3>
        <p style="margin:0;font-size:13px;color:#444">${address.address || ""}</p>
        ${address.mobile_no ? `<p style="margin:2px 0 0;font-size:12px;color:#777">Contact: ${address.mobile_no}</p>` : ""}
      </div>` : ""}

      ${carrierName ? `
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin:0 0 12px">
        <h3 style="margin:0 0 4px;font-size:14px">Delivery Partner (Carrier)</h3>
        <p style="margin:0;font-size:13px;color:#444">${carrierName}</p>
        ${carrierPhone ? `<p style="margin:2px 0 0;font-size:12px;color:#777">Contact: ${carrierPhone}</p>` : ""}
      </div>` : ""}

      <p style="font-size:12px;color:#999;margin:16px 0 0;text-align:center">
        This OTP is required to complete your delivery. Please share it only with your delivery partner.
      </p>
    </div>`;
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { email, otp, orderId } = req.body;
    console.log(`📩 OTP request for ${email}`);

    if (!email) return res.status(400).json({ error: "Email is required" });

    if (!otp) {
      const generatedOtp = generateOtp();
      otpStore.set(email, { otp: generatedOtp, expires: Date.now() + 5 * 60 * 1000 });

      let orderDetails = null;
      if (orderId) {
        orderDetails = await fetchOrderDetails(orderId);
      }

      try {
        const result = await sendEmail({
          to: email,
          subject: orderDetails
            ? `Your OTP for Order #${orderDetails.id} - Gathr Delivery`
            : "Your OTP Code - Gathr Delivery",
          html: buildOtpEmailHtml(generatedOtp, orderDetails),
        });

        console.log(`✅ OTP sent to ${email}: ${generatedOtp} via ${result.method}`);
        return res.json({ success: true, message: `OTP sent successfully via ${result.method}` });
      } catch (err) {
        console.error("❌ Failed to send OTP:", err);
        return res.status(500).json({ error: `Failed to send OTP: ${err.message}` });
      }
    }

    // --- Verify OTP ---
    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ verified: false, message: "OTP not found. Request a new one." });
    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({ verified: false, message: "OTP expired. Request a new one." });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ verified: false, message: "Invalid OTP. Try again." });
    }

    otpStore.delete(email);

    if (orderId) {
      try {
        const { data: order, error: orderError } = await supabase
          .from("Orders")
          .select("payment_method")
          .eq("id", orderId)
          .single();

        if (!orderError && order) {
          const updateData = { status: "delivered" };
          if (order.payment_method === "cod") {
            updateData.payment_status = "paid";
          }
          await supabase.from("Orders").update(updateData).eq("id", orderId);
          console.log(`✅ [OTP] Order #${orderId} marked delivered`);
        }
      } catch (dbErr) {
        console.error("❌ Failed to update order after OTP verify:", dbErr);
      }
    }

    return res.json({ verified: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("🔥 OTP route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
