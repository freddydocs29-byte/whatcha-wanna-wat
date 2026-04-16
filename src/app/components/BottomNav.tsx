"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/" },
  { label: "Saved", href: "/saved" },
  { label: "History", href: "/history" },
  { label: "Profile", href: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-4 rounded-full border border-white/10 bg-white/[0.055] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "rounded-full bg-white px-3 py-3 text-center text-sm font-semibold text-black"
                : "rounded-full px-3 py-3 text-center text-sm text-white/50 transition hover:text-white/75"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
