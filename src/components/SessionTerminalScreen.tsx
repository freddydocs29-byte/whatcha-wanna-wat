"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../app/lib/supabase";

export type SessionTerminalVariant = "expired" | "not-found" | "matched";

const CONFIG = {
  expired: {
    headline: "This session has expired.",
    subtext: "Sessions last 12 hours. Start a fresh one when you're ready.",
    primaryLabel: "Start a new one →",
  },
  "not-found": {
    headline: "Session not found.",
    subtext: "Double-check the code or ask for a new link.",
    primaryLabel: "Start your own →",
  },
  matched: {
    headline: "This one's already decided.",
    subtext: "Looks like a match was already found for this session.",
    primaryLabel: "Start a new one →",
  },
} as const;

export function SessionTerminalScreen({ variant }: { variant: SessionTerminalVariant }) {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [inputError, setInputError] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { headline, subtext, primaryLabel } = CONFIG[variant];

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setInputError(false);
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("session_code", code)
      .single();
    setSearching(false);
    if (data?.id) {
      router.push(`/session/${data.id}`);
    } else {
      setInputError(true);
    }
  }

  function handleTryDifferent() {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1C1A18] px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div
          className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "rgba(232,98,26,0.12)" }}
        />
      </div>

      {/* Icon */}
      <div
        className="w-20 h-20 rounded-[20px] bg-[#E8621A]/10 flex items-center justify-center"
        style={{ boxShadow: "0 0 40px rgba(232,98,26,0.18)" }}
      >
        <span className="font-display font-black text-4xl text-[#E8621A]">?</span>
      </div>

      {/* Text */}
      <div>
        <h1 className="font-display font-black text-3xl text-white text-center leading-tight">
          {headline}
        </h1>
        <p className="mt-3 font-body text-sm text-[#8A7F78] text-center max-w-xs mx-auto">
          {subtext}
        </p>
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => router.push("/")}
        className="w-full max-w-xs rounded-full bg-[#E8621A] px-8 py-4 font-display font-black text-base text-white transition hover:opacity-95 active:scale-[0.99]"
        style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
      >
        {primaryLabel}
      </button>

      {/* Ghost + code input — only for not-found */}
      {variant === "not-found" && (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={handleTryDifferent}
            className="w-full rounded-full border border-white/10 bg-white/[0.06] px-8 py-4 font-display font-black text-base text-white transition hover:opacity-80 active:scale-[0.99]"
          >
            Try a different code →
          </button>

          {showInput && (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3 mt-1">
              <input
                ref={inputRef}
                className="input-brand"
                placeholder="Enter session code"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  setInputError(false);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              {inputError && (
                <p className="font-body text-xs text-[#E8621A] text-left">
                  No session found with that code.
                </p>
              )}
              <button
                type="submit"
                disabled={searching || !inputCode.trim()}
                className="rounded-full bg-[#2A2420] border border-white/10 px-6 py-3 font-display font-black text-sm text-white transition hover:opacity-80 disabled:opacity-40"
              >
                {searching ? "Searching…" : "Find session →"}
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
