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
        // Warm cinematic atmosphere — subtle top radial glow + bottom vignette
        background:
          "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), " +
          "radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%), " +
          "#1C1A18",
      }}
    >
      {children}
    </div>
  );
}
