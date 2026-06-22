"use client";

import { useRouter } from "next/navigation";
import { trackEvent } from "../lib/analytics";
import { EVENT_GUEST_SIGNUP_PROMPTED } from "../lib/analytics-events";

interface GuestLimitPromptProps {
  /** Called when the guest dismisses the prompt without acting. */
  onClose: () => void;
}

/**
 * Bottom-sheet prompt shown when a guest has exhausted their free deck budget.
 * Routes to /auth with from=guest-limit so the auth page can show
 * contextual copy and restore any pending meal after sign-up.
 */
export default function GuestLimitPrompt({ onClose }: GuestLimitPromptProps) {
  const router = useRouter();

  function handleCreateAccount() {
    trackEvent(EVENT_GUEST_SIGNUP_PROMPTED, { from_reason: "guest_limit" });
    router.push("/auth?mode=signup&from=guest-limit");
  }

  function handleSignIn() {
    router.push("/auth?mode=signin&from=guest-limit");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      {/* Ambient radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(232,98,26,0.13) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative w-full rounded-t-[24px] px-6 pt-6 pb-10"
        style={{
          background: "#1C1A18",
          border: "1px solid rgba(245,237,224,0.10)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Film grain */}
        <div
          className="pointer-events-none absolute inset-0 rounded-t-[24px]"
          style={{
            opacity: 0.04,
            mixBlendMode: "overlay",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

        <h2
          className="font-display font-black text-2xl text-white leading-tight"
        >
          Want another round?
        </h2>
        <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
          Create a free account to keep deciding, save your picks, and build your flavor profile.
        </p>

        <button
          onClick={handleCreateAccount}
          className="mt-6 w-full text-[#1c0c03] font-display font-black text-base py-4 rounded-full transition active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
            boxShadow:
              "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 14px 30px rgba(232,98,26,0.45), 0 0 0 1px rgba(232,98,26,0.28)",
          }}
        >
          Create account
        </button>

        <button
          onClick={handleSignIn}
          className="mt-3 w-full font-body text-sm text-[#8A7F78] text-center py-3"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
