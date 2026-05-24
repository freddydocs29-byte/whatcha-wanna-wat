"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/identity";
import { linkAuthToProfile } from "../lib/supabase-profile";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read ?mode=signup|signin from URL — set by the splash screen buttons.
  const initialMode: Mode = searchParams.get("mode") === "signin" ? "signin" : "signup";
  const fromGuestMatch = searchParams.get("from") === "guest-match";
  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const anonUserId = getUserId();

    try {
      if (mode === "signup") {
        // 1. Create the Supabase Auth account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || null } },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        const authUid = data.user?.id;
        if (!authUid) {
          setError("Sign-up succeeded but no user ID was returned. Please try signing in.");
          return;
        }

        // 2. Link the new auth user to the existing anon profile,
        //    writing display_name and email at the same time.
        await linkAuthToProfile(authUid, anonUserId, name.trim() || undefined, email.trim() || undefined);

        if (data.session) {
          // Email confirmation is disabled — session is live immediately.
          // Guests signing up from the post-match screen already have preferences
          // from the session setup flow — send them straight to Home so the
          // decided meal locked state is visible. All other signups go to onboarding.
          router.replace(fromGuestMatch ? "/" : "/onboarding");
        } else {
          // Email confirmation is enabled — the session won't exist until the
          // user clicks the link in their inbox. Show a waiting screen.
          setDone(true);
        }

      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        // ProfileProvider's onAuthStateChange fires SIGNED_IN and resolves
        // the correct user_id via fetchProfileByAuthUserId — do not call
        // linkAuthToProfile here, which would risk overwriting a returning
        // user's existing profile with the current device's anon ID.
        router.replace("/");
      }
    } catch (err) {
      console.error("[auth] unexpected error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Post-signup confirmation screen ───────────────────────────────────────────
  if (done) {
    return (
      <main className="min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-6"
             style={{ boxShadow: "0 0 40px rgba(232,98,26,0.35)" }}>
          <span className="text-3xl text-white">✓</span>
        </div>
        <h1 className="font-display font-black text-2xl text-white text-center leading-tight">
          Check your email
        </h1>
        <p className="font-body text-sm text-[#8A7F78] text-center mt-3 leading-relaxed max-w-xs">
          We sent a confirmation link to <span className="text-white">{email}</span>.
          Click it to activate your account, then come back and sign in.
        </p>
        <button
          onClick={() => { setDone(false); switchMode("signin"); }}
          className="mt-10 w-full max-w-xs bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
          style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
        >
          Sign in
        </button>
        <button
          onClick={() => router.replace("/")}
          className="mt-4 font-body text-sm text-[#8A7F78]"
        >
          Back to app
        </button>
      </main>
    );
  }

  // ── Sign up / Sign in form ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1C1A18] flex flex-col relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(232,98,26,0.12) 0%, transparent 55%)" }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-14 pb-10 max-w-md mx-auto w-full">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="font-body text-sm text-[#8A7F78] self-start mb-10"
        >
          ← Back
        </button>

        {/* Heading */}
        <h1 className="font-display font-black text-3xl text-white leading-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="font-body text-sm text-[#8A7F78] mt-2">
          {mode === "signup"
            ? "Your existing preferences stay — we're just adding a login."
            : "Sign in to sync your profile across devices."}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 mt-8 bg-[#2A2420] rounded-full p-1">
          {(["signup", "signin"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 font-display font-black text-sm py-2.5 rounded-full transition-all ${
                mode === m
                  ? "bg-[#E8621A] text-white"
                  : "text-[#8A7F78]"
              }`}
            >
              {m === "signup" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
          {mode === "signup" && (
            <div>
              <label className="font-body text-xs text-[#8A7F78] uppercase tracking-widest block mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full bg-[#2A2420] border border-white/10 rounded-[14px] px-4 py-3.5 font-body text-base text-white placeholder:text-[#8A7F78]/50 focus:outline-none focus:border-[#E8621A]/60"
              />
            </div>
          )}

          <div>
            <label className="font-body text-xs text-[#8A7F78] uppercase tracking-widest block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full bg-[#2A2420] border border-white/10 rounded-[14px] px-4 py-3.5 font-body text-base text-white placeholder:text-[#8A7F78]/50 focus:outline-none focus:border-[#E8621A]/60"
            />
          </div>

          <div>
            <label className="font-body text-xs text-[#8A7F78] uppercase tracking-widest block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full bg-[#2A2420] border border-white/10 rounded-[14px] px-4 py-3.5 font-body text-base text-white placeholder:text-[#8A7F78]/50 focus:outline-none focus:border-[#E8621A]/60"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-[#E8621A] text-white font-display font-black text-lg py-4 rounded-full disabled:opacity-50"
            style={{ boxShadow: "0 0 40px rgba(232,98,26,0.3)" }}
          >
            {loading
              ? mode === "signup" ? "Creating…" : "Signing in…"
              : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="font-body text-xs text-[#8A7F78]/50 text-center mt-8 leading-relaxed">
          Your existing swipe history and preferences are always saved locally
          and will not be lost.
        </p>
      </div>

      {/* Detroit footer */}
      <p className="absolute bottom-8 w-full text-center font-body text-[11px] text-[#8A7F78]/30 tracking-widest uppercase pointer-events-none">
        Detroit, MI
      </p>
    </main>
  );
}
