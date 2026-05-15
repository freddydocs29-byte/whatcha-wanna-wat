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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1C1A18]"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.5s ease-out'
      }}
    >
      {/* Background orange glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(232,98,26,0.2) 0%, transparent 65%)' }}
      />

      {/* Pulsing ring + green circle */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div
          className="absolute w-48 h-48 rounded-full bg-[#4A7C59]/20"
          style={{
            transform: phase === 'enter' ? 'scale(0.6)' : 'scale(1)',
            opacity: phase === 'enter' ? 0 : 1,
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
            animation: phase === 'hold' ? 'pulse 2s ease-in-out infinite' : 'none'
          }}
        />
        {/* Green circle */}
        <div
          className="w-32 h-32 rounded-full bg-[#4A7C59] flex items-center justify-center relative z-10"
          style={{
            transform: phase === 'enter' ? 'scale(0)' : 'scale(1)',
            transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 0 60px rgba(74,124,89,0.5)'
          }}
        >
          <span
            className="font-display font-black text-5xl text-white"
            style={{
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
        className="text-center mt-8 px-6"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease-out 0.4s, transform 0.4s ease-out 0.4s'
        }}
      >
        <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase">
          TONIGHT&apos;S PICK
        </p>
        <h1 className="font-display font-black text-4xl text-white mt-2 leading-tight">
          Dinner is decided.
        </h1>
        <p className="font-display font-bold text-2xl text-[#4A7C59] mt-1">
          {meal.name}
        </p>
      </div>

      {/* Subtle "taking you home" hint */}
      <p
        className="absolute bottom-12 font-body text-sm text-white/30"
        style={{
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 0.4s ease-out 0.8s'
        }}
      >
        Taking you home...
      </p>
    </div>
  )
}
