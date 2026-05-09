"use client";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 40% 40%, rgba(232,98,26,0.12) 0%, transparent 60%)' }}
      />

      {/* App icon */}
      <div
        className="relative z-10 w-20 h-20 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-6"
        style={{ boxShadow: '0 0 50px rgba(232,98,26,0.35)' }}
      >
        <span className="font-display font-black text-5xl text-white">?</span>
      </div>

      {/* Wordmark */}
      <p className="relative z-10 font-display font-black text-2xl text-white leading-none">
        Watcha<span className="text-[#E8621A]">?</span>
      </p>
    </main>
  )
}
