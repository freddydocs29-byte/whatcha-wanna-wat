interface V3AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export default function V3AppShell({ children, className = "" }: V3AppShellProps) {
  return (
    <div
      className={`relative flex flex-col bg-[#1C1A18] overflow-hidden w-full ${className}`}
      style={{ minHeight: "100dvh" }}
    >
      {children}
    </div>
  );
}
