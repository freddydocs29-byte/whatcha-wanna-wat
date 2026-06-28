"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/identity";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext: "homepage" | "profile";
}

export default function FeedbackModal({ isOpen, onClose, pageContext }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit() {
    if (!message.trim() || status === "submitting") return;
    setStatus("submitting");

    try {
      const userId = getUserId() || null;
      const { error } = await supabase.from("feedback").insert({
        message: message.trim(),
        page_context: pageContext,
        user_id: userId,
        user_agent: navigator.userAgent,
      });

      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setMessage("");
      setStatus("idle");
    }, 300);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[81] flex items-center justify-center px-5 pointer-events-none"
          >
            <div
              className="w-full max-w-sm rounded-[24px] p-6 pointer-events-auto relative"
              style={{
                background: "#0B0805",
                border: "1px solid rgba(232,98,26,0.38)",
                boxShadow:
                  "0 32px 80px rgba(0,0,0,0.75), 0 0 40px rgba(232,98,26,0.07), inset 0 1px 0 rgba(245,237,224,0.05)",
              }}
            >
              {/* Close */}
              <button
                onClick={handleClose}
                aria-label="Close feedback"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: "rgba(245,237,224,0.07)", color: "rgba(245,237,224,0.45)" }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {status === "success" ? (
                <div className="py-6 text-center">
                  <p
                    className="text-base font-display font-black leading-snug"
                    style={{ color: "#F5EDE0" }}
                  >
                    Thank you — this helps us make Watcha better.
                  </p>
                </div>
              ) : (
                <>
                  <h2
                    className="text-xl font-display font-black mb-1.5 pr-8"
                    style={{ color: "#F5EDE0" }}
                  >
                    Tell us what felt off
                  </h2>
                  <p
                    className="font-body text-sm mb-5"
                    style={{ color: "rgba(199,189,172,0.65)" }}
                  >
                    We&apos;re reading every note during soft launch.
                  </p>

                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    placeholder="Bug, confusing moment, bad food suggestion, something you loved…"
                    rows={5}
                    className="w-full rounded-[14px] px-4 py-3 font-body text-sm resize-none outline-none mb-4 placeholder:text-[#5A5350]"
                    style={{
                      background: "rgba(255,231,202,0.04)",
                      border: "1px solid rgba(245,237,224,0.1)",
                      color: "#C7BDAC",
                      caretColor: "#E8621A",
                    }}
                  />

                  {status === "error" && (
                    <p
                      className="font-body text-xs mb-3"
                      style={{ color: "rgba(232,98,26,0.9)" }}
                    >
                      Something went wrong. Try again.
                    </p>
                  )}

                  <button
                    onClick={() => void handleSubmit()}
                    disabled={!message.trim() || status === "submitting"}
                    className="w-full py-3.5 rounded-pill font-display font-black text-base text-white disabled:opacity-40 transition-opacity"
                    style={{
                      background: "linear-gradient(135deg, #FF8A3D 0%, #E8621A 100%)",
                      boxShadow: message.trim()
                        ? "0 0 24px rgba(232,98,26,0.35)"
                        : "none",
                    }}
                  >
                    {status === "submitting" ? "Sending…" : "Send feedback"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
