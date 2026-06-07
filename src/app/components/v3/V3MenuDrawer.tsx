"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface V3MenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: "Home", href: "/", emoji: "🏠" },
  { label: "Saved Meals", href: "/saved", emoji: "🔖" },
  { label: "History", href: "/history", emoji: "🕐" },
  { label: "Profile", href: "/profile", emoji: "👤" },
  { label: "Top 5", href: "/top5", emoji: "🏆" },
];

export default function V3MenuDrawer({ open, onClose }: V3MenuDrawerProps) {
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
                "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.10) 0%, transparent 60%), " +
                "#211E1B",
              borderRight: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "6px 0 40px rgba(0,0,0,0.5)",
              minHeight: "100dvh",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-[60px] pb-6">
              <div className="leading-none">
                <span
                  className="block text-[20px] font-black text-white leading-none tracking-[-0.3px]"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  Watcha
                </span>
                <span
                  className="block text-[16px] font-bold text-[#E8621A] leading-[1.15]"
                  style={{ fontFamily: "'Dancing Script', cursive" }}
                >
                  wanna eat?
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#2A2420] flex items-center justify-center text-[#8A7F78] hover:text-white transition"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-white/[0.05] mb-4" />

            {/* Nav items */}
            <nav className="flex-1 px-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3.5 rounded-2xl mb-1 hover:bg-white/[0.04] active:bg-white/[0.07] transition group"
                >
                  <span className="text-xl w-7 text-center">{item.emoji}</span>
                  <span
                    className="text-[15px] font-bold text-[#D4CFC9] group-hover:text-white transition"
                    style={{ fontFamily: "var(--font-nunito)" }}
                  >
                    {item.label}
                  </span>
                  <span className="ml-auto text-[#E8621A] opacity-0 group-hover:opacity-60 transition text-sm">›</span>
                </Link>
              ))}
            </nav>

            {/* Bottom brand accent */}
            <div className="px-5 pb-10 pt-6">
              <div className="h-px bg-white/[0.05] mb-5" />
              <p
                className="text-[11px] text-[#4A4540]"
                style={{ fontFamily: "var(--font-manrope)" }}
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
