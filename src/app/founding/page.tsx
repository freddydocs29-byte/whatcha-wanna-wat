"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const VALID_CODES = new Set(["FIRSTBITE", "FIRST BITE"]);

export default function FoundingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (VALID_CODES.has(code.trim().toUpperCase())) {
      localStorage.setItem("founding_taster_access", "true");
      router.push("/auth?mode=signup");
    } else {
      setError(true);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6"
      style={{ background: "#0B0805" }}
    >
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, opacity: 0.05, mixBlendMode: "overlay" }}
        aria-hidden
      />
      {/* Ember ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(232,98,26,0.14) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 50% 100%, rgba(232,98,26,0.06) 0%, transparent 50%)",
        }}
        aria-hidden
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px 30px rgba(0,0,0,0.55)" }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Wordmark */}
        <p
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#897E73",
            marginBottom: 40,
          }}
        >
          Watcha?
        </p>

        {/* Headline */}
        <h1
          className="text-center"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 38,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#F6EEE2",
            marginBottom: 16,
          }}
        >
          Stop asking.
          <br />
          Start eating.
        </h1>

        {/* Subhead */}
        <p
          className="text-center"
          style={{
            fontFamily: "var(--font-sans, system-ui)",
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.6,
            color: "#897E73",
            marginBottom: 48,
            maxWidth: 300,
          }}
        >
          You've been invited to help shape Watcha? — a private early look at a
          better way to decide what's for dinner.
        </p>

        {/* Code form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(false);
            }}
            placeholder="Enter your access code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-[14px] px-4 py-4 text-center transition-colors focus:outline-none"
            style={{
              fontFamily: "var(--font-jetbrains-mono, monospace)",
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.12em",
              background: "rgba(255,231,202,0.045)",
              border: error
                ? "1px solid rgba(239,68,68,0.5)"
                : code.length > 0
                ? "1px solid rgba(232,98,26,0.4)"
                : "1px solid rgba(245,237,224,0.085)",
              color: "#F6EEE2",
            }}
          />

          {error && (
            <p
              className="text-center"
              style={{
                fontFamily: "var(--font-sans, system-ui)",
                fontSize: 13,
                color: "rgba(239,68,68,0.85)",
              }}
            >
              That code doesn't look right.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-full py-4 transition-opacity active:opacity-90"
            style={{
              background:
                "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
              boxShadow:
                "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
              color: "#1c0c03",
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
              marginTop: 4,
            }}
          >
            Let's eat
          </button>
        </form>
      </div>
    </main>
  );
}
