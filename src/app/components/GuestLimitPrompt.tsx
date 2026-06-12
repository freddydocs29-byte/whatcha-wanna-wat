"use client";

import { useRouter } from "next/navigation";

interface GuestLimitPromptProps {
  /** Called when the guest dismisses the prompt without acting. */
  onClose: () => void;
}

/**
 * Bottom-sheet prompt shown when a guest has exhausted their free retry.
 * Routes to /auth with from=guest-limit so the auth page can show
 * contextual copy and restore any pending meal after sign-up.
 */
export default function GuestLimitPrompt({ onClose }: GuestLimitPromptProps) {
  const router = useRouter();

  function handleCreateAccount() {
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
      <div
        className="w-full rounded-t-[24px] px-6 pt-6 pb-10"
        style={{
          background: "#1A1410",
          border: "1px solid rgba(245,237,224,0.10)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          className="mt-6 w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
          style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
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
