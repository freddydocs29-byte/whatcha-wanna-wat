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
        className="relative w-full bg-[#1C1A18] rounded-t-[28px] px-6 pt-5 pb-10 border-t border-white/[0.08]"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-[#8A7F78] hover:text-white/60 transition"
          aria-label="Close"
        >
          ✕
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
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              Invite someone to decide with you tonight.
            </p>
            <p className="font-body text-xs text-[#8A7F78]/60 mt-1">
              They&apos;ll show up here after you match.
            </p>

            {createError && (
              <p className="font-body text-xs text-red-400 mt-3">{createError}</p>
            )}

            <button
              onClick={handleStart}
              disabled={creating}
              className="w-full mt-6 rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white shadow-[0_0_20px_rgba(232,98,26,0.3)] transition active:scale-[0.98] disabled:opacity-60"
              style={{ fontFamily: "var(--font-nunito)" }}
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
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              Send this to whoever you&apos;re deciding with tonight.
            </p>

            {/* Join URL pill */}
            <div className="mt-4 bg-[#2A2420] rounded-[16px] px-4 py-3 border border-white/[0.08]">
              <p className="font-body text-[10px] text-[#8A7F78] mb-1 uppercase tracking-wider">
                Join link
              </p>
              <p className="font-body text-sm text-white/90 break-all leading-relaxed">
                {joinUrl}
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              {/* Share — shown when Web Share API is available */}
              <button
                onClick={handleShare}
                className="flex-1 rounded-full bg-[#E8621A] py-3.5 font-display font-black text-sm text-white shadow-[0_0_20px_rgba(232,98,26,0.3)] transition active:scale-[0.98]"
                style={{ fontFamily: "var(--font-nunito)" }}
              >
                Share →
              </button>

              {/* Copy fallback — always shown */}
              <button
                onClick={handleCopy}
                className="flex-1 rounded-full border border-white/20 bg-white/[0.07] py-3.5 font-display font-black text-sm text-white transition active:scale-[0.98]"
                style={{ fontFamily: "var(--font-nunito)" }}
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
