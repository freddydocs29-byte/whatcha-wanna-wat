"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { SessionTerminalScreen } from "../../../components/SessionTerminalScreen";

type TerminalState = "not-found" | "expired" | "matched" | null;

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [terminal, setTerminal] = useState<TerminalState>(null);

  useEffect(() => {
    if (!code) {
      setTerminal("not-found");
      return;
    }

    const resolve = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, status, expires_at")
        .eq("session_code", code.toUpperCase())
        .single();

      if (error || !data) {
        setTerminal("not-found");
        return;
      }

      // Check terminal states before redirecting
      const isExpired =
        data.status === "expired" ||
        (data.expires_at && new Date(data.expires_at) <= new Date());

      if (isExpired) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("wwe_active_session");
        }
        setTerminal("expired");
        return;
      }

      if (data.status === "matched") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("wwe_active_session");
        }
        setTerminal("matched");
        return;
      }

      router.replace(`/session/${data.id}`);
    };

    void resolve();
  }, [code, router]);

  if (terminal) {
    return <SessionTerminalScreen variant={terminal} />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#1C1A18] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div
          className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "rgba(232,98,26,0.08)" }}
        />
      </div>
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8621A]/60 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E8621A]/80" />
        </span>
        <p className="font-body text-sm text-[#8A7F78]">Joining session…</p>
      </div>
    </main>
  );
}
