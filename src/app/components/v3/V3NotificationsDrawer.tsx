"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface PendingInvite {
  id: string;
  session_id: string;
  session_code: string;
  from_user_id: string;
  vibe: string | null;
  inviterName: string | null;
  inviterAvatar: string | null;
}

interface ActiveSession {
  sessionId: string;
  sessionCode: string | null;
  status: string;
  vibe?: string;
}

interface V3NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  pendingInvite: PendingInvite | null;
  activeSession: ActiveSession | null;
  onJoinInvite: () => void;
  onDismissInvite: () => void;
  onResume: () => void;
}

export default function V3NotificationsDrawer({
  open,
  onClose,
  pendingInvite,
  activeSession,
  onJoinInvite,
  onDismissInvite,
  onResume,
}: V3NotificationsDrawerProps) {
  const hasNotifications = !!(pendingInvite || activeSession);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="notif-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) onClose();
            }}
            className="relative z-10 rounded-t-[28px] px-5 pt-5 pb-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.08) 0%, transparent 60%), " +
                "#211E1B",
              border: "1px solid rgba(255,255,255,0.05)",
              borderBottom: "none",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Drag handle */}
            <div className="w-9 h-1 bg-[#3D3733] rounded-full mx-auto mb-5" />

            {/* Title */}
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[19px] font-black text-white"
                style={{ fontFamily: "var(--font-nunito)" }}
              >
                Alerts
              </p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#2A2420] flex items-center justify-center text-[#8A7F78] hover:text-white transition text-sm"
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            {!hasNotifications ? (
              /* Empty state */
              <div className="py-8 text-center">
                <div className="text-4xl mb-3">🔔</div>
                <p
                  className="text-[15px] font-bold text-[#D4CFC9]"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  No dinner alerts right now.
                </p>
                <p
                  className="text-[13px] text-[#5A5350] mt-1"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  We&apos;ll let you know when someone invites you.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-8 py-2.5 rounded-full border border-[#3D3733] text-[#8A7F78] text-sm font-semibold transition active:scale-[0.97]"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Pending invite */}
                {pendingInvite && (
                  <div
                    className="rounded-[20px] p-4 border border-[#4A7C59]/35"
                    style={{
                      background: "rgba(74,124,89,0.07)",
                      boxShadow: "0 0 24px rgba(74,124,89,0.10), inset 0 1px 0 rgba(245,237,224,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#4A7C59]/30"
                        style={{ background: "rgba(74,124,89,0.15)" }}
                      >
                        {pendingInvite.inviterAvatar ? (
                          <Image
                            src={pendingInvite.inviterAvatar}
                            alt=""
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-base font-bold text-[#4A7C59]">
                            {pendingInvite.inviterName
                              ? pendingInvite.inviterName[0].toUpperCase()
                              : "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-black text-white"
                          style={{ fontFamily: "var(--font-nunito)" }}
                        >
                          {pendingInvite.inviterName ?? "Someone"} wants to decide dinner.
                        </p>
                        <p
                          className="text-xs text-[#8A7F78] mt-0.5"
                          style={{ fontFamily: "var(--font-manrope)" }}
                        >
                          Join their Watcha session.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => { onJoinInvite(); onClose(); }}
                            className="flex-1 rounded-full bg-[#4A7C59] py-2 font-black text-xs text-white transition active:scale-[0.98]"
                            style={{ fontFamily: "var(--font-nunito)" }}
                          >
                            Join
                          </button>
                          <button
                            onClick={() => { onDismissInvite(); }}
                            className="flex-1 rounded-full border border-[#3A3530] py-2 font-black text-xs text-[#8A7F78] transition active:scale-[0.98]"
                            style={{ fontFamily: "var(--font-nunito)" }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active session */}
                {activeSession && (
                  <div
                    className="rounded-[20px] p-4 border border-[#E8621A]/40 bg-[#2A2420] cursor-pointer transition-all duration-200 active:scale-[0.99]"
                    style={{ boxShadow: "0 0 20px rgba(232,98,26,0.12)" }}
                    onClick={() => { onResume(); onClose(); }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#E8621A]/10 flex items-center justify-center flex-shrink-0 text-xl">
                        👥
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-black text-white"
                          style={{ fontFamily: "var(--font-nunito)" }}
                        >
                          {activeSession.status === "waiting"
                            ? "Waiting for your partner"
                            : activeSession.status === "ready"
                            ? "Your partner joined! Tap to continue"
                            : "Session in progress"}
                        </p>
                        {activeSession.sessionCode && (
                          <p
                            className="text-xs text-[#8A7F78] mt-0.5"
                            style={{ fontFamily: "var(--font-manrope)" }}
                          >
                            Code: {activeSession.sessionCode}
                          </p>
                        )}
                      </div>
                      <span className="text-[#E8621A] text-lg flex-shrink-0">→</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
