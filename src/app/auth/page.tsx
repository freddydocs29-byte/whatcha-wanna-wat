"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { clearAllLocalState, getUserId } from "../lib/identity";
import { linkAuthToProfile } from "../lib/supabase-profile";

type Mode = "signin" | "signup" | "forgot";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Shared ambient + grain + vignette layers used on every auth screen */
function AmbientLayers() {
  return (
    <>
      {/* Ember ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 30% at 60% 0%, rgba(232,98,26,0.12) 0%, transparent 55%), radial-gradient(ellipse 40% 25% at 0% 80%, rgba(232,98,26,0.04) 0%, transparent 50%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, opacity: 0.05, mixBlendMode: "overlay" }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 100px 20px rgba(0,0,0,0.5)" }}
      />
    </>
  );
}

const inputClass =
  "w-full rounded-[14px] px-4 py-3.5 font-body text-base text-white placeholder:text-[#897E73]/60 focus:outline-none transition-colors";
const inputStyle = {
  background: "rgba(255,231,202,0.045)",
  border: "1px solid rgba(245,237,224,0.085)",
};
const inputFocusStyle = {
  background: "rgba(255,231,202,0.07)",
  border: "1px solid rgba(232,98,26,0.26)",
};

function AuthInput({
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
}: {
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      autoComplete={autoComplete}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={inputClass}
      style={focused ? inputFocusStyle : inputStyle}
    />
  );
}

const primaryBtnStyle = {
  background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
  boxShadow:
    "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
  color: "#1c0c03",
  fontFamily: "var(--font-quicksand)",
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: "-0.01em",
};

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read ?mode=signup|signin from URL — set by the splash screen buttons.
  const initialMode: Mode = searchParams.get("mode") === "signin" ? "signin" : "signup";
  const fromGuestMatch = searchParams.get("from") === "guest-match";
  // True when the user is upgrading from a guest session — preserve existing copy.
  const isGuestUpgrade =
    searchParams.get("from") === "guest" ||
    searchParams.get("from") === "guest-save" ||
    searchParams.get("from") === "guest-limit";
  // Used as a belt-and-suspenders fallback: if guest-home somehow failed to
  // write wwe_pending_guest_meal, we can still copy watcha_decided_meal at
  // submit time before the auth state change fires.
  const pendingMealId = searchParams.get("mealId");
  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleResend() {
    setResendStatus("sending");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setResendStatus(error ? "error" : "sent");
    if (!error) {
      window.setTimeout(() => setResendStatus("idle"), 3000);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotStatus("sending");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setForgotStatus(error ? "error" : "sent");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const anonUserId = getUserId();

    // Belt-and-suspenders: if coming from a guest match, ensure the decided
    // meal is protected in the pending key before the auth state change fires.
    // guest-home writes this key on button click; this fallback covers edge
    // cases where that write was missed (new tab, storage quota error, etc.).
    if (fromGuestMatch) {
      try {
        if (!localStorage.getItem("wwe_pending_guest_meal")) {
          const decidedRaw = localStorage.getItem("watcha_decided_meal");
          if (decidedRaw) {
            // Only copy if the meal matches the mealId passed in the URL (when present).
            const meal = JSON.parse(decidedRaw) as { id?: string };
            if (!pendingMealId || meal?.id === pendingMealId) {
              localStorage.setItem("wwe_pending_guest_meal", decidedRaw);
            }
          }
        }
      } catch { /* non-fatal — ProfileProvider applies the key on its own */ }
    }

    try {
      if (mode === "signup") {
        // 0. Wipe any stale localStorage/sessionStorage state from a previous
        //    account on this device before the new account is created.
        //    This runs BEFORE signUp, profile creation, and any restore logic
        //    so the new account starts from a genuine blank slate — exactly as
        //    if the browser were in incognito / first-install mode.
        //    anonUserId and wwe_pending_guest_meal (not in APP_STORAGE_KEYS) are
        //    both captured above and will not be affected by this clear.
        clearAllLocalState();

        // 1. Create the Supabase Auth account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() || null },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
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
        //
        // If fromGuestMatch: the wwe_pending_guest_meal key written above is
        // applied by ProfileProvider's applyPendingGuestMeal() at the end of
        // initializeProfile, after all profile restores complete. This prevents
        // the returning user's Supabase last_decided_meal from overwriting the
        // guest match result.
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
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
        style={{ background: "#0B0805" }}
      >
        <AmbientLayers />
        <div className="relative z-10 flex flex-col items-center">
          {/* Glass icon box */}
          <div
            className="w-16 h-16 rounded-[22%] flex items-center justify-center mb-6"
            style={{
              background: "rgba(232,98,26,0.10)",
              border: "1px solid rgba(232,98,26,0.26)",
              boxShadow: "0 0 40px rgba(232,98,26,0.22)",
            }}
          >
            <span className="text-3xl" style={{ color: "#E8621A" }}>✓</span>
          </div>
          <h1
            className="text-center leading-tight"
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 26,
              color: "#F6EEE2",
              letterSpacing: "-0.01em",
            }}
          >
            Check your email
          </h1>
          <p
            className="text-center mt-3 leading-relaxed max-w-xs"
            style={{ fontFamily: "var(--font-sans, system-ui)", fontWeight: 300, fontSize: 14, color: "#897E73" }}
          >
            We sent a confirmation link to{" "}
            <span style={{ color: "#F6EEE2" }}>{email}</span>.
            Click it to activate your account, then come back and sign in.
          </p>
          <button
            onClick={() => { setDone(false); switchMode("signin"); }}
            className="mt-10 w-full max-w-xs rounded-full py-4 transition-opacity active:opacity-90"
            style={primaryBtnStyle}
          >
            Sign in
          </button>
          <button
            onClick={handleResend}
            disabled={resendStatus === "sending" || resendStatus === "sent"}
            className="mt-4 w-full max-w-xs rounded-full py-3.5 disabled:opacity-50 transition-opacity active:opacity-90"
            style={{
              border: "1px solid rgba(232,98,26,0.3)",
              background: "rgba(232,98,26,0.08)",
              color: resendStatus === "sent" ? "#E8621A" : "#F6EEE2",
              fontFamily: "var(--font-quicksand)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {resendStatus === "sending"
              ? "Sending…"
              : resendStatus === "sent"
              ? "Email sent"
              : resendStatus === "error"
              ? "Failed — try again"
              : "Resend confirmation email"}
          </button>
          <button
            onClick={() => router.replace("/")}
            className="mt-4"
            style={{ fontFamily: "var(--font-sans, system-ui)", fontSize: 13, color: "#897E73" }}
          >
            Back to app
          </button>
        </div>
      </main>
    );
  }

  // ── Sign up / Sign in form ────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#0B0805" }}
    >
      <AmbientLayers />

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-14 pb-10 max-w-md mx-auto w-full">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="self-start mb-10 transition-opacity active:opacity-70"
          style={{ fontFamily: "var(--font-sans, system-ui)", fontSize: 13, color: "#897E73" }}
        >
          ← Back
        </button>

        {/* Heading */}
        <h1
          className="leading-tight"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 32,
            color: "#F6EEE2",
            letterSpacing: "-0.01em",
          }}
        >
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        <p
          className="mt-2"
          style={{ fontFamily: "var(--font-sans, system-ui)", fontWeight: 300, fontSize: 13, color: "#897E73" }}
        >
          {mode === "signup"
            ? isGuestUpgrade
              ? "Your existing preferences stay — we're just adding a login."
              : "Create your Watcha account and we'll start learning your taste."
            : mode === "forgot"
            ? "Enter your email and we'll send you a reset link."
            : "Sign in to sync your profile across devices."}
        </p>

        {/* Mode toggle — only signup / signin; forgot is an inline sub-view */}
        {mode !== "forgot" && (
          <div
            className="flex gap-1 mt-8 rounded-full p-1"
            style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
          >
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="flex-1 rounded-full py-2.5 transition-all"
                style={
                  mode === m
                    ? {
                        background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                        boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -1px 0 rgba(120,52,0,0.3) inset, 0 4px 12px rgba(232,98,26,0.3)",
                        color: "#1c0c03",
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        fontSize: 14,
                      }
                    : {
                        color: "#897E73",
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 600,
                        fontSize: 14,
                      }
                }
              >
                {m === "signup" ? "Sign up" : "Sign in"}
              </button>
            ))}
          </div>
        )}

        {/* ── Forgot password inline form ──────────────────────────────── */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4 mt-8">
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#897E73",
                }}
              >
                Email
              </label>
              <AuthInput
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {forgotStatus === "error" && (
              <p className="font-body text-sm text-red-400 text-center">Something went wrong. Please try again.</p>
            )}
            {forgotStatus === "sent" && (
              <p className="font-body text-sm text-center" style={{ color: "#E8621A" }}>
                Check your email for a password reset link.
              </p>
            )}

            {forgotStatus !== "sent" && (
              <button
                type="submit"
                disabled={forgotStatus === "sending"}
                className="mt-2 w-full rounded-full py-4 disabled:opacity-50 transition-opacity active:opacity-90"
                style={primaryBtnStyle}
              >
                {forgotStatus === "sending" ? "Sending…" : "Send reset link"}
              </button>
            )}

            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-center"
              style={{ fontFamily: "var(--font-sans, system-ui)", fontSize: 13, color: "#897E73" }}
            >
              ← Back to sign in
            </button>
          </form>
        )}

        {/* ── Sign up / Sign in form ───────────────────────────────────── */}
        {mode !== "forgot" && (
          <>
            {/* Google OAuth */}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                  },
                });
              }}
              className="mt-8 w-full flex items-center justify-center gap-3 rounded-full py-4 transition-opacity active:opacity-80"
              style={{
                background: "rgba(255,231,202,0.06)",
                border: "1px solid rgba(245,237,224,0.14)",
                color: "#F6EEE2",
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {/* Google icon (SVG) */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Or divider */}
            <div className="flex items-center gap-3 mt-5">
              <div className="flex-1 h-px" style={{ background: "rgba(245,237,224,0.08)" }} />
              <span
                className="font-body text-xs flex-shrink-0"
                style={{ color: "rgba(137,126,115,0.5)", letterSpacing: "0.08em" }}
              >
                or
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(245,237,224,0.08)" }} />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-5">
              {mode === "signup" && (
                <div>
                  <label
                    className="block mb-2"
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#897E73",
                    }}
                  >
                    Name
                  </label>
                  <AuthInput
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              )}

              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "#897E73",
                  }}
                >
                  Email
                </label>
                <AuthInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#897E73",
                    }}
                  >
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      style={{ fontFamily: "var(--font-sans, system-ui)", fontSize: 11, color: "#897E73" }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <AuthInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              {error && (
                <p className="font-body text-sm text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-full py-4 disabled:opacity-50 transition-opacity active:opacity-90"
                style={primaryBtnStyle}
              >
                {loading
                  ? mode === "signup" ? "Creating…" : "Signing in…"
                  : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p
              className="text-center mt-8 leading-relaxed"
              style={{ fontFamily: "var(--font-sans, system-ui)", fontWeight: 300, fontSize: 12, color: "rgba(137,126,115,0.5)" }}
            >
              Your existing swipe history and preferences are always saved locally
              and will not be lost.
            </p>
          </>
        )}
      </div>

      {/* Detroit footer */}
      <p
        className="absolute bottom-8 w-full text-center pointer-events-none"
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(137,126,115,0.3)",
        }}
      >
        Detroit, MI
      </p>
    </main>
  );
}
