"use client";

import Link from "next/link";

type NavTab = "home" | "saved" | "history" | "profile";

const TAB_HREFS: Record<NavTab, string> = {
  home: "/",
  saved: "/saved",
  history: "/history",
  profile: "/profile",
};

interface V3BottomNavProps {
  active?: NavTab;
}

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const SavedIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const TABS: { key: NavTab; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "Home", icon: <HomeIcon /> },
  { key: "saved", label: "Saved", icon: <SavedIcon /> },
  { key: "history", label: "History", icon: <HistoryIcon /> },
  { key: "profile", label: "Profile", icon: <ProfileIcon /> },
];

export default function V3BottomNav({ active = "home" }: V3BottomNavProps) {
  return (
    <nav
      className="flex justify-around items-center pt-3 pb-5 bg-[#2A2420] border-t border-white/[0.05] mt-auto shrink-0"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={TAB_HREFS[tab.key]}
            className="flex flex-col items-center gap-1 cursor-pointer px-3 py-1"
          >
            <span
              className={`flex items-center justify-center w-6 h-6 ${
                isActive ? "text-[#E8621A]" : "text-[#5A5350]"
              }`}
            >
              {tab.icon}
            </span>
            <span
              className={`text-[10px] font-semibold tracking-[0.5px] ${
                isActive ? "text-[#E8621A]" : "text-[#5A5350]"
              }`}
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
