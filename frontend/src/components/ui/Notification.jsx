"use client";

import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

export const showToast = {
  success: (message) => {
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`max-w-md w-full bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-lg rounded-2xl pointer-events-auto flex items-center p-4 gap-3 z-[99999]`}
      >
        <CheckCircle className="text-emerald-500 shrink-0 w-5 h-5" />
        <div className="flex-1 text-sm font-semibold">{message}</div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--muted)]/50 transition-colors"
        >
          ✕
        </button>
      </motion.div>
    ));
  },
  error: (message) => {
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`max-w-md w-full bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-lg rounded-2xl pointer-events-auto flex items-center p-4 gap-3 z-[99999]`}
      >
        <XCircle className="text-rose-500 shrink-0 w-5 h-5" />
        <div className="flex-1 text-sm font-semibold">{message}</div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--muted)]/50 transition-colors"
        >
          ✕
        </button>
      </motion.div>
    ));
  },
  info: (message) => {
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`max-w-md w-full bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-lg rounded-2xl pointer-events-auto flex items-center p-4 gap-3 z-[99999]`}
      >
        <Info className="text-blue-500 shrink-0 w-5 h-5" />
        <div className="flex-1 text-sm font-semibold">{message}</div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--muted)]/50 transition-colors"
        >
          ✕
        </button>
      </motion.div>
    ));
  },
  warning: (message) => {
    toast.custom((t) => (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`max-w-md w-full bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] shadow-lg rounded-2xl pointer-events-auto flex items-center p-4 gap-3 z-[99999]`}
      >
        <AlertCircle className="text-amber-500 shrink-0 w-5 h-5" />
        <div className="flex-1 text-sm font-semibold">{message}</div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--muted)]/50 transition-colors"
        >
          ✕
        </button>
      </motion.div>
    ));
  },
};
