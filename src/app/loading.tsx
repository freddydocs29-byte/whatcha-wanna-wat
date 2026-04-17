import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black animate-[fadeIn_0.4s_ease-in]">
      <div className="animate-[breathe_3s_ease-in-out_infinite]" style={{ filter: "drop-shadow(0 0 24px rgba(255,255,255,0.25))" }}>
        <Image
          src="/logo.png"
          alt="Whatcha Wanna Eat"
          width={120}
          height={120}
          priority
          className="select-none"
        />
      </div>

      <div className="mt-8">
        <div
          className="w-5 h-5 rounded-full animate-spin"
          style={{
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderTopColor: "white",
          }}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
