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
    <main className="flex min-h-screen items-center justify-center bg-[#1C1A18] text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="h-2 w-2 animate-ping rounded-full bg-[#E8621A]/60" />
        <p className="font-body text-sm text-[#8A7F78]">Joining session…</p>
      </div>
    </main>
  );
}
