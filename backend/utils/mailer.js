import nodemailer from "nodemailer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

/**
 * Sends an email using SMTP (Nodemailer) or falls back to Mailjet API.
 * 
 * @param {Object} options
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.html HTML content of the email
 * @param {string} [options.text] Plain text fallback content
 * @returns {Promise<{success: boolean, method: string, info: any}>}
 */
export async function sendEmail({ to, subject, html, text }) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    MJ_APIKEY_PUBLIC,
    MJ_APIKEY_PRIVATE,
    MJ_SENDER_EMAIL
  } = process.env;

  const isRender = process.env.RENDER === "true";
  const hasMailjet = !!(MJ_APIKEY_PUBLIC && MJ_APIKEY_PRIVATE && MJ_SENDER_EMAIL);

  // 1. Try SMTP if configured (Skip SMTP on Render if Mailjet is configured to avoid network timeout delays)
  if (SMTP_HOST && SMTP_USER && SMTP_PASS && (!isRender || !hasMailjet)) {
    try {
      console.log(`[mailer] Attempting to send email via SMTP to ${to}...`);
      const isSecure = SMTP_SECURE === "true" || SMTP_PORT === "465";
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || "587"),
        secure: isSecure,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        connectionTimeout: 5000, // 5 seconds connection timeout
        greetingTimeout: 5000,   // 5 seconds greeting timeout
        tls: {
          // Do not fail on invalid / self-signed certs (useful for free public domains SMTP like rediffmail)
          rejectUnauthorized: false,
          minVersion: "TLSv1",
          ciphers: "DEFAULT@SECLEVEL=0",
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
        }
      });

      const info = await transporter.sendMail({
        from: `"Gathr" <${SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      console.log(`[mailer] SMTP success! MessageId: ${info.messageId}`);
      return { success: true, method: "SMTP", info };
    } catch (smtpError) {
      console.error("[mailer] SMTP delivery failed, falling back to Mailjet:", smtpError.message);
    }
  }

  // 2. Try Mailjet if SMTP falls through or is not configured
  if (MJ_APIKEY_PUBLIC && MJ_APIKEY_PRIVATE && MJ_SENDER_EMAIL) {
    try {
      console.log(`[mailer] Attempting to send email via Mailjet to ${to}...`);
      const auth = Buffer.from(`${MJ_APIKEY_PUBLIC}:${MJ_APIKEY_PRIVATE}`).toString("base64");
      const response = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: MJ_SENDER_EMAIL,
                Name: "Gathr",
              },
              To: [
                {
                  Email: to,
                },
              ],
              Subject: subject,
              TextPart: text || undefined,
              HTMLPart: html,
            },
          ],
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.ErrorMessage || result?.Messages?.[0]?.Errors?.[0]?.ErrorMessage || "Mailjet API error");
      }

      const msgResult = result.Messages?.[0] || {};
      if (msgResult.Status !== "success") {
        throw new Error(msgResult.Errors?.map(e => e.ErrorMessage).join("; ") || "Unknown Mailjet delivery error");
      }

      console.log(`[mailer] Mailjet success! MessageID: ${msgResult.To?.[0]?.MessageID}`);
      return { success: true, method: "Mailjet", info: msgResult };
    } catch (mjError) {
      console.error("[mailer] Mailjet delivery failed:", mjError.message);
      throw mjError;
    }
  }

  throw new Error("No valid mail sending configuration (SMTP or Mailjet) found in environment variables.");
}
