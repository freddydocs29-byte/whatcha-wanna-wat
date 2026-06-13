"use client";

export interface ActiveSessionForBanner {
  sessionId: string;
  sessionCode: string | null;
  status: string;
  vibe?: string;
}

/** Computes the headline and subtext for the active-session banner.
 *  Exported so other surfaces (e.g. V3NotificationsDrawer) can stay in sync
 *  without duplicating the variant logic. */
export function computeBannerText(
  activeSession: ActiveSessionForBanner,
  userDoneSwiping: boolean,
  partnerDoneSwiping: boolean,
): { headline: string; subtext: string | null } {
  const isSwiping =
    activeSession.status === "swiping" ||
    activeSession.status === "active" ||
    activeSession.status === "abandoned";

  const variant =
    activeSession.status === "waiting" ? "waiting" :
    activeSession.status === "ready" ? "ready" :
    isSwiping && !userDoneSwiping && partnerDoneSwiping ? "partner-done" :
    isSwiping && userDoneSwiping && partnerDoneSwiping ? "both-done" :
    isSwiping && userDoneSwiping && !partnerDoneSwiping ? "user-done" :
    "swiping";

  const headline =
    variant === "waiting" ? "Waiting for your partner" :
    variant === "ready" ? "Your partner joined! Tap to continue" :
    variant === "partner-done" ? "Your partner finished swiping" :
    variant === "user-done" ? "You\u2019re done swiping" :
    variant === "both-done" ? "No match yet" :
    "Session in progress \u00b7 Tap to keep swiping";

  const subtext: string | null =
    variant === "partner-done" ? "Your turn to finish \u00b7 Tap to keep swiping" :
    variant === "user-done" ? `Waiting on their picks \u00b7 Code: ${activeSession.sessionCode ?? ""}` :
    variant === "both-done" ? "You both finished swiping \u00b7 See what they liked" :
    variant === "waiting" && activeSession.sessionCode ? `Code: ${activeSession.sessionCode}` :
    null;

  return { headline, subtext };
}

interface SessionResumeBannerProps {
  activeSession: ActiveSessionForBanner;
  userDoneSwiping: boolean;
  partnerDoneSwiping: boolean;
  onResume: () => void;
  onDismiss: () => void;
}

export default function SessionResumeBanner({
  activeSession,
  userDoneSwiping,
  partnerDoneSwiping,
  onResume,
  onDismiss,
}: SessionResumeBannerProps) {
  const isSwiping =
    activeSession.status === "swiping" ||
    activeSession.status === "active" ||
    activeSession.status === "abandoned";

  const bannerVariant: "waiting" | "ready" | "swiping" | "partner-done" | "user-done" | "both-done" =
    activeSession.status === "waiting" ? "waiting" :
    activeSession.status === "ready" ? "ready" :
    isSwiping && !userDoneSwiping && partnerDoneSwiping ? "partner-done" :
    isSwiping && userDoneSwiping && partnerDoneSwiping ? "both-done" :
    isSwiping && userDoneSwiping && !partnerDoneSwiping ? "user-done" :
    "swiping";

  const bannerBorderClass =
    bannerVariant === "partner-done" ? "border-[#4A7C59]/50" :
    bannerVariant === "both-done" ? "border-[#C9983A]/40" :
    "border-[#E8621A]/40";

  const bannerBoxShadow =
    bannerVariant === "partner-done" ? "0 0 24px rgba(74,124,89,0.2)" :
    "0 0 20px rgba(232,98,26,0.15)";

  const bannerDotClass =
    bannerVariant === "partner-done" ? "bg-[#4A7C59]" :
    bannerVariant === "both-done" ? "bg-[#C9983A]" :
    "bg-[#E8621A]";

  const bannerDotPingClass =
    bannerVariant === "partner-done" ? "bg-[#4A7C59]/70" : "bg-[#E8621A]/70";

  const bannerHeadline =
    bannerVariant === "waiting" ? "Waiting for your partner" :
    bannerVariant === "ready" ? "Your partner joined! Tap to continue" :
    bannerVariant === "partner-done" ? "Your partner finished swiping" :
    bannerVariant === "user-done" ? "You\u2019re done swiping" :
    bannerVariant === "both-done" ? "No match yet" :
    "Session in progress \u00b7 Tap to keep swiping";

  const bannerSubtext: string | null =
    bannerVariant === "partner-done" ? "Your turn to finish \u00b7 Tap to keep swiping" :
    bannerVariant === "user-done" ? `Waiting on their picks \u00b7 Code: ${activeSession.sessionCode ?? ""}` :
    bannerVariant === "both-done" ? "You both finished swiping \u00b7 See what they liked" :
    bannerVariant === "waiting" && activeSession.sessionCode ? `Code: ${activeSession.sessionCode}` :
    null;

  return (
    <section
      className={`mx-[14px] mb-2 rounded-[20px] p-4 border cursor-pointer transition-all duration-300 shrink-0 ${bannerBorderClass}`}
      style={{ background: "rgba(255,231,202,0.05)", boxShadow: bannerBoxShadow }}
      onClick={onResume}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${bannerDotPingClass} opacity-75`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${bannerDotClass}${bannerVariant === "partner-done" ? " animate-pulse" : ""}`} />
          </span>
          <span className="text-[#8A7F78] text-[10px] font-semibold tracking-widest uppercase">
            Active session
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="text-[#8A7F78] text-base leading-none hover:text-white/50 w-6 h-6 flex items-center justify-center"
          aria-label="Dismiss session banner"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${bannerVariant === "partner-done" ? "bg-[#4A7C59]/10" : "bg-[#E8621A]/10"}`}>
          👥
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-sm text-white">
            {bannerHeadline}
          </p>
          {bannerSubtext && (
            <p className="font-body text-xs text-[#8A7F78] mt-0.5">
              {bannerSubtext}
            </p>
          )}
        </div>
        <span className={`text-lg flex-shrink-0 ${bannerVariant === "partner-done" ? "text-[#4A7C59]" : "text-[#E8621A]"}`}>→</span>
      </div>
    </section>
  );
}
