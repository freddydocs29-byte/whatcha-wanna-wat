"use client";

import Link from "next/link";
import { trackEvent } from "../lib/analytics";

export default function BackToHomeLink() {
  return (
    <Link
      href="/"
      onClick={() => trackEvent("back_home_clicked")}
      className="rounded-full border border-white/10 bg-transparent px-5 py-4 text-center text-base font-medium text-white/70"
    >
      Back to home
    </Link>
  );
}
