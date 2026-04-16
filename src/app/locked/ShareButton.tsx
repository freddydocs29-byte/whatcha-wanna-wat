"use client";

import { useState } from "react";

export default function ShareButton({ mealName }: { mealName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const title = `We eating ${mealName} tonight`;
    const text = `We eating ${mealName} tonight 🍽️\nLocked it in on Whatcha Wanna Eat`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(`${text}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleShare}
      className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-base font-medium text-white transition active:scale-[0.99]"
    >
      {copied ? "Copied to clipboard" : "Share it"}
    </button>
  );
}
