"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface V3InviteDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Code from an already-active shared session, if one exists */
  activeSessionCode?: string | null;
  /** Creates a new session and returns its id + code. Should NOT navigate. */
  onCreateSession: () => Promise<{ sessionId: string; sessionCode: string } | null>;
  /** Called after a session is successfully created from this drawer */
  onSessionCreated?: (session: { sessionId: string; sessionCode: string }) => void;
}

export default function V3InviteDrawer({
  open,
  onClose,
  activeSessionCode,
  onCreateSession,
  onSessionCreated,
}: V3InviteDrawerProps) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Prefer the active session passed in from parent, fall back to one created in this drawer
  const sessionCode = activeSessionCode ?? createdCode;
  const joinUrl =
    sessionCode && typeof window !== "undefined"
      ? `${window.location.origin}/join/${sessionCode}`
      : null;

  async function handleStart() {
    setCreating(true);
    setCreateError(null);
    const result = await onCreateSession();
    setCreating(false);
    if (result) {
      setCreatedCode(result.sessionCode);
      onSessionCreated?.(result);
    } else {
      setCreateError("Couldn't start a session. Check your connection and try again.");
    }
  }

  async function handleCopy() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  async function handleShare() {
    if (!joinUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Decide dinner with me",
          text: "Join me to swipe on what we're eating tonight!",
          url: joinUrl,
        });
        return;
      } catch {
        // User cancelled share — fall through to copy
      }
    }
    await handleCopy();
  }

  function handleClose() {
    setCreatedCode(null);
    setCreateError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            key="invite-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="invite-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) handleClose();
            }}
            className="relative w-full rounded-t-[28px] px-6 pt-5 pb-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 60%), " +
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), " +
                "#211E1B",
              border: "1px solid rgba(245,237,224,0.07)",
              borderBottom: "none",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,237,224,0.07)",
            }}
          >
            {/* Handle */}
            <div
              className="w-10 h-1 rounded-full mx-auto mb-5"
              style={{ background: "rgba(245,237,224,0.15)" }}
            />

            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-[#8A7F78] hover:text-white transition"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(245,237,224,0.08)",
                borderRadius: "50%",
              }}
              aria-label="Close"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!sessionCode ? (
              /* ── No active session ── */
              <>
                <p
                  className="text-[22px] font-black text-white leading-tight"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  Invite someone
                </p>
                <p
                  className="text-sm text-[#8A7F78] mt-2 leading-relaxed"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Invite someone to decide with you tonight.
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(138,127,120,0.60)", fontFamily: "var(--font-manrope)" }}
                >
                  They&apos;ll show up here after you match.
                </p>

                {createError && (
                  <p
                    className="text-xs text-red-400 mt-3"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {createError}
                  </p>
                )}

                <button
                  onClick={handleStart}
                  disabled={creating}
                  className="w-full mt-6 rounded-full py-4 font-black text-base text-white transition active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                    boxShadow: "0 0 24px rgba(232,98,26,0.30)",
                    fontFamily: "var(--font-nunito)",
                  }}
                >
                  {creating ? "Starting…" : "Start shared session"}
                </button>
              </>
            ) : (
              /* ── Session active — show join link ── */
              <>
                <p
                  className="text-[22px] font-black text-white leading-tight"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  Share the link
                </p>
                <p
                  className="text-sm text-[#8A7F78] mt-2 leading-relaxed"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Send this to whoever you&apos;re deciding with tonight.
                </p>

                {/* Session code pill */}
                {sessionCode && (
                  <div className="mt-4 flex items-center justify-center">
                    <span
                      className="text-[28px] font-black tracking-[6px] text-white px-5 py-2 rounded-[14px]"
                      style={{
                        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                        background: "rgba(232,98,26,0.08)",
                        border: "1px solid rgba(232,98,26,0.22)",
                        boxShadow: "0 0 20px rgba(232,98,26,0.10)",
                        letterSpacing: "0.18em",
                      }}
                    >
                      {sessionCode}
                    </span>
                  </div>
                )}

                {/* Join URL display */}
                <div
                  className="mt-3 rounded-[14px] px-4 py-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(245,237,224,0.07)",
                  }}
                >
                  <p
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{ color: "#8A7F78", fontFamily: "var(--font-manrope)" }}
                  >
                    Join link
                  </p>
                  <p
                    className="text-sm text-white/80 break-all leading-relaxed"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {joinUrl}
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  {/* Share — primary gradient */}
                  <button
                    onClick={handleShare}
                    className="flex-1 rounded-full py-3.5 font-black text-sm text-white transition active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                      boxShadow: "0 0 20px rgba(232,98,26,0.28)",
                      fontFamily: "var(--font-nunito)",
                    }}
                  >
                    Share →
                  </button>

                  {/* Copy — glass secondary */}
                  <button
                    onClick={handleCopy}
                    className="flex-1 rounded-full py-3.5 font-black text-sm text-white transition active:scale-[0.98]"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(245,237,224,0.10)",
                      fontFamily: "var(--font-nunito)",
                    }}
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
