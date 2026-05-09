"use client";

interface SplashScreenProps {
  onLetsGo?: () => void;
  onSignIn?: () => void;
}

export default function SplashScreen({ onLetsGo, onSignIn }: SplashScreenProps) {
  return (
    <main className="min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 40% 40%, rgba(232,98,26,0.15) 0%, transparent 60%)" }}
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

        {/* Wordmark */}
        <p className="font-display font-black text-4xl text-white leading-none text-center">
          Watcha Wanna Eat<span className="text-[#E8621A]">?</span>
        </p>

        {/* Tagline */}
        <p className="font-body text-[#8A7F78] text-sm tracking-widest uppercase text-center mt-3">
          Finally, an answer.
        </p>

        {/* CTA button */}
        <div className="w-full mt-16">
          <button
            onClick={onLetsGo}
            className="w-full bg-[#E8621A] text-white font-display font-black text-lg py-4 rounded-full text-center"
            style={{ boxShadow: "0 0 40px rgba(232,98,26,0.3)" }}
          >
            Let&apos;s go
          </button>
        </div>

        {/* Sign in link */}
        <p className="text-center mt-4 font-body text-sm text-[#8A7F78]">
          Already have an account?{" "}
          <button onClick={onSignIn} className="text-[#E8621A] font-semibold">
            Sign in
          </button>
        </p>
      </div>

      {/* Detroit footer */}
      <p className="absolute bottom-8 font-body text-[11px] text-[#8A7F78]/40 tracking-widest uppercase">
        Detroit, MI
      </p>
    </main>
  );
}
