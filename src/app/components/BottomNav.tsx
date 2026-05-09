"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/" },
  { label: "Saved", href: "/saved" },
  { label: "History", href: "/history" },
  { label: "Profile", href: "/profile" },
];

export default function BottomNav({ activeHref }: { activeHref?: string } = {}) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#2A2420] border-t border-white/[0.06] flex justify-around items-center px-4 pt-3"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      {tabs.map((tab) => {
        const isActive = (activeHref ?? pathname) === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "text-center text-sm font-semibold text-[#E8621A]"
                : "text-center text-sm text-[#8A7F78] transition hover:text-white/75"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
