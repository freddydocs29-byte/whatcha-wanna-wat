"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface V3MenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M6 5h12v6a6 6 0 0 1-6 6 6 6 0 0 1-6-6V5z" />
      <path d="M9 21h6" />
      <path d="M12 17v4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Saved Meals", href: "/saved", Icon: BookmarkIcon },
  { label: "History", href: "/history", Icon: ClockIcon },
  { label: "Profile", href: "/profile", Icon: UserIcon },
  { label: "Top 5", href: "/top5", Icon: TrophyIcon },
];

export default function V3MenuDrawer({ open, onClose }: V3MenuDrawerProps) {
  const pathname = usePathname();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex">
          {/* Backdrop */}
          <motion.div
            key="menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer — slides in from left */}
          <motion.div
            key="menu-drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.25, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -400) onClose();
            }}
            className="relative z-10 w-[280px] flex flex-col"
            style={{
              background:
                "radial-gradient(ellipse 80% 100% at 15% 0%, rgba(232,98,26,0.12) 0%, transparent 60%), " +
                "linear-gradient(180deg, #1a1410 0%, #0d0805 70%)",
              borderRight: "1px solid rgba(245,237,224,0.085)",
              boxShadow: "30px 0 60px rgba(0,0,0,0.6), inset -1px 0 0 rgba(245,237,224,0.04)",
              minHeight: "100dvh",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-[60px] pb-6">
              <div className="leading-none">
                <span
                  className="block text-[22px] text-white leading-none"
                  style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, letterSpacing: "-0.01em" }}
                >
                  Watcha
                </span>
                <span
                  className="block text-[16px] text-[#E8621A] leading-[1.15]"
                  style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontWeight: 400 }}
                >
                  wanna eat?
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A7F78] hover:text-white transition"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(245,237,224,0.08)",
                }}
                aria-label="Close menu"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Hairline divider */}
            <div className="mx-5 h-px mb-4" style={{ background: "rgba(245,237,224,0.06)" }} />

            {/* Nav items */}
            <nav className="flex-1 px-3">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="group flex items-center gap-4 px-3 py-3 rounded-[14px] mb-1 transition-all active:scale-[0.98]"
                    style={{
                      background: isActive ? "rgba(232,98,26,0.07)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span
                      className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-colors"
                      style={isActive ? {
                        background: "radial-gradient(circle at 40% 32%, #FF8A3D, #E8621A 70%, #B84A12)",
                        border: "none",
                        color: "#fff",
                        boxShadow: "0 6px 16px rgba(232,98,26,0.35)",
                      } : {
                        background: "rgba(255,231,202,0.045)",
                        border: "1px solid rgba(245,237,224,0.085)",
                        color: "#8A7F78",
                      }}
                    >
                      <item.Icon />
                    </span>
                    <span
                      className="text-[17px] transition-colors"
                      style={{
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        color: isActive ? "#F6EEE2" : "#C7BDAC",
                      }}
                    >
                      {item.label}
                    </span>
                    {!isActive && (
                      <span className="ml-auto text-[#E8621A] opacity-0 group-hover:opacity-50 transition text-sm">›</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom brand accent */}
            <div className="px-5 pb-10 pt-6">
              <div className="h-px mb-5" style={{ background: "rgba(245,237,224,0.06)" }} />
              <p
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 10,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "#574E45",
                }}
              >
                Watcha Wanna Eat · v3
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
