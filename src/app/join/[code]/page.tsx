"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) {
      setNotFound(true);
      return;
    }

    const resolve = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id")
        .eq("session_code", code.toUpperCase())
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      router.replace(`/session/${data.id}`);
    };

    void resolve();
  }, [code, router]);

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1C1A18] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="w-20 h-20 rounded-full bg-[#E8621A]/10 flex items-center justify-center">
          <span className="font-display font-black text-4xl text-[#E8621A]">?</span>
        </div>
        <div>
          <h1 className="font-display font-black text-2xl text-white leading-tight">
            Session not found.
          </h1>
          <p className="mt-2 font-body text-sm text-[#8A7F78]">
            The link may be expired or the code is incorrect.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-full bg-[#E8621A] px-8 py-4 font-display font-black text-base text-white transition hover:opacity-95 active:scale-[0.99]"
          style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
        >
          Start your own →
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1C1A18] text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="h-2 w-2 animate-ping rounded-full bg-[#E8621A]/60" />
        <p className="font-body text-sm text-[#8A7F78]">Joining session…</p>
      </div>
    </main>
  );
}
