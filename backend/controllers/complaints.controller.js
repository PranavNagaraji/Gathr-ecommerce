import supabase from "../db.js";
import { sendEmail } from "../utils/mailer.js";

export const createComplaint = async (req, res) => {
  try {
    const { name = "", email = "", message = "", clerkId } = req.body || {};
    const user_clerk_id = clerkId || req.user?.sub || null;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    const payload = {
      user_clerk_id,
      name: name || null,
      email: email || null,
      message: String(message),
      status: "open",
    };
    const { data, error } = await supabase
      .from("Complaints")
      .insert([payload])
      .select("*")
      .single();
    if (error) return res.status(500).json({ message: "Failed to create complaint", error: error.message });

    // Send unified notification email to admin
    try {
      const adminEmail = process.env.ADMIN_CONTACT_EMAIL || process.env.SMTP_USER;
      if (adminEmail) {
        const emailSubject = `New Contact Form Submission from ${name || "Anonymous"}`;
        const emailHtml = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px;color:#111">
            <h2 style="color:#111;margin:0 0 16px;font-size:20px;border-bottom:1px solid #eee;padding-bottom:10px">New Contact Submission Received</h2>
            <p style="margin:6px 0;font-size:14px"><strong>Name:</strong> ${name || "Anonymous"}</p>
            <p style="margin:6px 0;font-size:14px"><strong>Email:</strong> ${email || "Not provided"}</p>
            <p style="margin:6px 0;font-size:14px"><strong>Clerk ID:</strong> ${user_clerk_id || "Guest"}</p>
            <hr style="border:0;border-top:1px solid #eee;margin:16px 0" />
            <p style="margin:0 0 8px;font-size:14px"><strong>Message:</strong></p>
            <blockquote style="margin:0;padding:12px 16px;background:#f5f5f5;border-left:4px solid #111;font-style:italic;font-size:14px;white-space:pre-wrap;border-radius:0 4px 4px 0">${message}</blockquote>
          </div>
        `;
        await sendEmail({
          to: adminEmail,
          subject: emailSubject,
          html: emailHtml
        });
        console.log(`[Complaints] Admin notification email sent successfully to ${adminEmail}`);
      }
    } catch (mailErr) {
      console.error("[Complaints] Failed to send admin email notification:", mailErr.message);
    }

    return res.status(201).json({ complaint: data });
  } catch (e) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listComplaints = async (req, res) => {
  try {
    const { status, q, from, to } = req.query || {};
    let query = supabase.from("Complaints").select("*").order("created_at", { ascending: false });
    const s = String(status || "").toLowerCase();
    if (["open", "resolved"].includes(s)) {
      query = query.eq("status", s);
    }
    if (from) {
      const f = new Date(from);
      if (!isNaN(f.getTime())) query = query.gte("created_at", f.toISOString());
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t.getTime())) query = query.lte("created_at", t.toISOString());
    }
    // For q, fetch a reasonable set then filter in JS to match multiple fields
    const { data, error } = await query.limit(1000);
    if (error) return res.status(500).json({ message: "Failed to fetch complaints", error: error.message });
    let out = data || [];
    const term = String(q || "").trim().toLowerCase();
    if (term) {
      out = out.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const email = String(c.email || "").toLowerCase();
        const uid = String(c.user_clerk_id || "").toLowerCase();
        const msg = String(c.message || "").toLowerCase();
        return name.includes(term) || email.includes(term) || uid.includes(term) || msg.includes(term);
      });
    }
    return res.status(200).json({ complaints: out });
  } catch (e) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!id) return res.status(400).json({ message: "Missing complaint id" });
    const s = String(status || "").toLowerCase();
    if (!["open", "resolved"].includes(s)) return res.status(400).json({ message: "Invalid status" });
    const { data, error } = await supabase
      .from("Complaints")
      .update({ status: s })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ message: "Failed to update complaint", error: error.message });
    return res.status(200).json({ complaint: data });
  } catch (e) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
