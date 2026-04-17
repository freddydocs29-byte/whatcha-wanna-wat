"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-white/35 transition hover:text-white/60"
    >
      Back
    </button>
  );
}
