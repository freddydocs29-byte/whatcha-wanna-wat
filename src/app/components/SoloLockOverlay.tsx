'use client'

import { useEffect, useState } from 'react'

type Props = {
  meal: { name: string; image?: string; emoji?: string }
  onComplete: () => void
}

export default function SoloLockOverlay({ meal, onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    // Phase timing: enter → hold → exit → navigate
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('exit'), 2000)
    const t3 = setTimeout(() => onComplete(), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0805]"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.5s ease-out'
      }}
    >
      {/* Film grain */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />

      {/* Ambient green glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 38%, rgba(94,158,110,0.18) 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(184,74,18,0.10) 0%, transparent 66%)' }}
      />

      {/* Pulsing ring + green orb */}
      <div className="relative flex items-center justify-center">
        {/* Outermost faint ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 240, height: 240,
            background: "rgba(94,158,110,0.04)",
            transform: phase === 'enter' ? 'scale(0.5)' : 'scale(1)',
            opacity: phase === 'enter' ? 0 : 1,
            transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease-out',
          }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 196, height: 196,
            background: "rgba(94,158,110,0.08)",
            transform: phase === 'enter' ? 'scale(0.6)' : 'scale(1)',
            opacity: phase === 'enter' ? 0 : 1,
            transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.45s ease-out',
            animation: phase === 'hold' ? 'pulse 2s ease-in-out infinite' : 'none'
          }}
        />
        {/* Green orb */}
        <div
          className="flex items-center justify-center relative z-10"
          style={{
            width: 140, height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle at 42% 36%, #86C796, #5E9E6E 55%, #3F744F)",
            transform: phase === 'enter' ? 'scale(0)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 0 70px rgba(94,158,110,0.5), 0 0 0 18px rgba(94,158,110,0.08), 0 0 0 38px rgba(94,158,110,0.04)',
          }}
        >
          <span
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 56,
              color: "#fff",
              opacity: phase === 'enter' ? 0 : 1,
              transition: 'opacity 0.3s ease-out 0.3s'
            }}
          >
            ✓
          </span>
        </div>
      </div>

      {/* Text content */}
      <div
        className="text-center mt-10 px-6"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease-out 0.4s, transform 0.4s ease-out 0.4s'
        }}
      >
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "3px", textTransform: "uppercase", color: "#86A972" }}>
          TONIGHT&apos;S PICK
        </p>
        <h1 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 38, color: "#F6EEE2", marginTop: 10, lineHeight: 1, letterSpacing: "-0.02em" }}>
          Dinner is decided.
        </h1>
        <p style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 26, color: "#5E9E6E", marginTop: 6 }}>
          {meal.name}
        </p>
      </div>

      {/* Subtle "taking you home" hint */}
      <p
        className="absolute bottom-12 text-sm"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 300,
          color: "#574E45",
          letterSpacing: "0.3px",
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 0.4s ease-out 0.8s'
        }}
      >
        Taking you home...
      </p>
    </div>
  )
}
