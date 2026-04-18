"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { hasCompletedOnboarding } from "../lib/storage";

export default function FirstTimeVisitorCTA() {
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    setIsFirstTime(!hasCompletedOnboarding());
  }, []);

  if (!isFirstTime) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 rounded-[34px] border border-white/10 bg-gradient-to-b from-white/[0.07] via-white/[0.04] to-white/[0.02] p-5"
    >
      <p className="text-sm text-white/40">Someone sent you this?</p>
      <p className="mt-2 text-[17px] font-medium leading-snug tracking-[-0.02em] text-white/80">
        This is how friends decide dinner — swipe until something clicks.
      </p>
      <Link
        href="/onboarding"
        className="mt-4 block rounded-full border border-white/15 bg-white/10 px-5 py-3.5 text-center text-[15px] font-semibold text-white"
      >
        Try it yourself
      </Link>
    </motion.div>
  );
}
