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
    <nav className="grid grid-cols-4 bg-[#2A2420] border-t border-white/[0.06] p-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "rounded-full px-3 py-3 text-center text-sm font-semibold text-[#E8621A]"
                : "rounded-full px-3 py-3 text-center text-sm text-[#8A7F78] transition hover:text-white/75"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
