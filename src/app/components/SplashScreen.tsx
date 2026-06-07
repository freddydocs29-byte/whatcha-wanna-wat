"use client";

interface SplashScreenProps {
  onLetsGo?: () => void;
  onSignIn?: () => void;
}

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function SplashScreen({ onLetsGo, onSignIn }: SplashScreenProps) {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient ember glow — two-layer radial, matches mockup body */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 22% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 100% 50%, rgba(232,98,26,0.04) 0%, transparent 60%)",
        }}
      />

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: GRAIN_SVG,
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 100px 20px rgba(0,0,0,0.5)" }}
      />

      {/* Centered content column */}
      <div className="relative z-10 flex flex-col items-center px-6 w-full">
        {/* App icon */}
        <div
          className="w-24 h-24 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-8"
          style={{ boxShadow: "0 0 60px rgba(232,98,26,0.4)" }}
        >
          <span className="font-display font-black text-6xl text-white">?</span>
        </div>

        {/* Wordmark — Quicksand + Instrument Serif italic, mirroring V3WatchaHeader */}
        <div className="flex flex-col items-center" style={{ lineHeight: 0.85 }}>
          <span
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 46,
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
              fontSize: 26,
              color: "#E8621A",
              marginTop: 4,
              lineHeight: 1.1,
            }}
          >
            wanna eat?
          </span>
        </div>

        {/* Tagline */}
        <p
          className="text-center mt-4"
          style={{
            fontFamily: "var(--font-sans, system-ui)",
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#897E73",
          }}
        >
          Finally, an answer.
        </p>

        {/* Primary CTA — gradient button */}
        <div className="w-full mt-16">
          <button
            onClick={onLetsGo}
            className="w-full rounded-full text-center transition-opacity active:opacity-90"
            style={{
              background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
              boxShadow:
                "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
              color: "#1c0c03",
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 16,
              padding: "15px",
              letterSpacing: "-0.01em",
            }}
          >
            Let&apos;s go
          </button>
        </div>

        {/* Sign in link — handlers untouched */}
        <p
          className="text-center mt-4"
          style={{
            fontFamily: "var(--font-sans, system-ui)",
            fontWeight: 400,
            fontSize: 13,
            color: "#897E73",
          }}
        >
          Already have an account?{" "}
          <button
            onClick={onSignIn}
            style={{ color: "#E8621A", fontWeight: 600 }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Detroit footer */}
      <p
        className="absolute bottom-8 pointer-events-none"
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(137,126,115,0.4)",
        }}
      >
        Detroit, MI
      </p>
    </main>
  );
}
