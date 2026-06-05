"use client";

import Link from "next/link";
import axios from "axios";
import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

export default function MerchantContactPage() {
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
  const { getToken } = useAuth();
  const { user } = useUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!message.trim()) { setStatus("Please enter a message."); return; }

    try {
      setSubmitting(true);
      const token = await getToken().catch(() => null);
      const whoEmail = user?.primaryEmailAddress?.emailAddress || email || "";
      const clerkId = user?.id || null;

      await axios.post(
        `${API_URL}/api/complaints/create`,
        { name, email: whoEmail || email, message, clerkId },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      setStatus("Thanks! Your complaint has been recorded.");
      setName(""); setEmail(""); setMessage("");
    } catch (e) {
      setStatus("Failed to send. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-[var(--background)] text-[var(--foreground)] py-12">
      <div className="rounded-3xl border border-[var(--border)] p-12 bg-[var(--card)] shadow-xl">
        <h1 className="text-4xl font-bold mb-8">Contact Us</h1>

        <form className="grid gap-8 md:grid-cols-2" onSubmit={onSubmit}>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              suppressHydrationWarning={true}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl px-4 py-3 border border-[var(--border)] bg-[var(--background)] text-lg animate-none"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              suppressHydrationWarning={true}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-xl px-4 py-3 border border-[var(--border)] bg-[var(--background)] text-lg animate-none"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-3">
            <label className="text-sm font-medium">Message</label>
            <textarea
              rows={6}
              value={message}
              suppressHydrationWarning={true}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we assist you?"
              className="rounded-xl px-4 py-3 border border-[var(--border)] bg-[var(--background)] text-lg animate-none"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-6">
            <button
              type="submit"
              disabled={submitting}
              suppressHydrationWarning={true}
              className="px-8 py-4 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]
              font-semibold text-lg hover:opacity-90 disabled:opacity-60 transition cursor-pointer"
            >
              {submitting ? "Sending…" : "Send Message"}
            </button>

            {status && (
              <p className="text-md text-[var(--muted-foreground)]">{status}</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
