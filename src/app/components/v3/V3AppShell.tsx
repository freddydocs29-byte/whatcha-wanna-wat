interface V3AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export default function V3AppShell({ children, className = "" }: V3AppShellProps) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden w-full max-w-[430px] mx-auto ${className}`}
      style={{
        minHeight: "100dvh",
        background: "#0B0805",
      }}
    >
      {/* Ambient glow layers — three radials that breathe slowly */}
      <div
        className="absolute inset-0 z-0 pointer-events-none candlelight-animate"
        style={{
          background:
            "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.16) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 40% at 50% 104%, rgba(184,74,18,0.16) 0%, transparent 66%)," +
            "radial-gradient(ellipse 40% 22% at 84% 30%, rgba(230,178,106,0.06) 0%, transparent 70%)",
          animation: "candlelight-amb 9s ease-in-out infinite",
        }}
      />

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          opacity: 0.05,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette depth */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)",
        }}
      />

      {/* Content sits above ambient layers */}
      <div className="relative z-[2] flex flex-col flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
