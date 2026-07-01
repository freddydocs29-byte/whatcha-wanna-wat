"use client";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function Loading() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#0B0805" }}
    >
      {/* Ember ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 22% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 60%), radial-gradient(ellipse 40% 25% at 100% 50%, rgba(232,98,26,0.04) 0%, transparent 60%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, opacity: 0.05, mixBlendMode: "overlay" }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 100px 20px rgba(0,0,0,0.5)" }}
      />

      {/* App icon */}
      <div
        className="relative z-10 w-20 h-20 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-8"
        style={{ boxShadow: "0 0 60px rgba(232,98,26,0.4)" }}
      >
        <span
          className="font-display font-black text-5xl text-white"
          style={{ display: "inline-block", animation: "watchaSplash 1.4s ease-in-out infinite" }}
        >?</span>
      </div>

      {/* Wordmark — Quicksand + Instrument Serif italic, matching Splash */}
      <div className="relative z-10 flex flex-col items-center" style={{ lineHeight: 0.85 }}>
        <span
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 32,
            color: "#F6EEE2",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          Watcha
        </span>
        <span
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 18,
            color: "#E8621A",
            marginTop: 3,
            lineHeight: 1.1,
          }}
        >
          wanna eat?
        </span>
      </div>
    </main>
  );
}
