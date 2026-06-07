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

function BellIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
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
                "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 60%), " +
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), " +
                "#211E1B",
              border: "1px solid rgba(245,237,224,0.07)",
              borderBottom: "none",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,237,224,0.07)",
            }}
          >
            {/* Drag handle */}
            <div
              className="w-9 h-1 rounded-full mx-auto mb-5"
              style={{ background: "rgba(245,237,224,0.15)" }}
            />

            {/* Title row */}
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[19px] font-black text-white"
                style={{ fontFamily: "var(--font-nunito)" }}
              >
                Alerts
              </p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A7F78] hover:text-white transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(245,237,224,0.08)",
                }}
                aria-label="Close notifications"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content */}
            {!hasNotifications ? (
              /* Empty state */
              <div className="py-10 text-center flex flex-col items-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(232,98,26,0.08)",
                    border: "1px solid rgba(232,98,26,0.18)",
                    color: "#E8621A",
                  }}
                >
                  <BellIcon />
                </div>
                <p
                  className="text-[15px] font-bold text-[#D4CFC9]"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  No dinner alerts right now.
                </p>
                <p
                  className="text-[13px] text-[#5A5350] mt-1 leading-relaxed max-w-[220px]"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  We&apos;ll let you know when someone invites you.
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-8 py-2.5 rounded-full text-[#8A7F78] text-sm font-semibold transition active:scale-[0.97]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(245,237,224,0.09)",
                    fontFamily: "var(--font-manrope)",
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Pending invite */}
                {pendingInvite && (
                  <div
                    className="rounded-[20px] p-4"
                    style={{
                      background: "rgba(74,124,89,0.07)",
                      border: "1px solid rgba(74,124,89,0.28)",
                      boxShadow: "0 0 24px rgba(74,124,89,0.08), inset 0 1px 0 rgba(245,237,224,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{
                          background: "rgba(74,124,89,0.15)",
                          border: "1px solid rgba(74,124,89,0.30)",
                        }}
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
                            className="flex-1 rounded-full py-2 font-black text-xs text-white transition active:scale-[0.98]"
                            style={{
                              background: "linear-gradient(135deg, #5EA06E 0%, #4A7C59 60%, #3A6347 100%)",
                              boxShadow: "0 0 14px rgba(74,124,89,0.30)",
                              fontFamily: "var(--font-nunito)",
                            }}
                          >
                            Join
                          </button>
                          <button
                            onClick={() => { onDismissInvite(); }}
                            className="flex-1 rounded-full py-2 font-black text-xs text-[#8A7F78] transition active:scale-[0.98]"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(245,237,224,0.09)",
                              fontFamily: "var(--font-nunito)",
                            }}
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
                  <button
                    className="w-full rounded-[20px] p-4 text-left transition-all duration-200 active:scale-[0.99]"
                    style={{
                      background: "rgba(232,98,26,0.07)",
                      border: "1px solid rgba(232,98,26,0.28)",
                      boxShadow: "0 0 20px rgba(232,98,26,0.10), inset 0 1px 0 rgba(245,237,224,0.04)",
                    }}
                    onClick={() => { onResume(); onClose(); }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "rgba(232,98,26,0.12)",
                          border: "1px solid rgba(232,98,26,0.25)",
                          color: "#E8621A",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
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
                      <span className="text-[#E8621A] flex-shrink-0">
                        <ArrowRightIcon />
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
