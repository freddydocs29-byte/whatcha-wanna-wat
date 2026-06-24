"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

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

const labelStyle = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "#897E73",
};

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="password"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required
      minLength={8}
      autoComplete="new-password"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={inputClass}
      style={focused ? inputFocusStyle : inputStyle}
    />
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      window.setTimeout(() => router.replace("/"), 2000);
    } catch (err) {
      console.error("[auth/reset] unexpected error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#0B0805" }}
    >
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

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-14 pb-10 max-w-md mx-auto w-full">
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
          {done ? "Password updated" : "Set a new password"}
        </h1>
        <p
          className="mt-2"
          style={{ fontFamily: "var(--font-sans, system-ui)", fontWeight: 300, fontSize: 13, color: "#897E73" }}
        >
          {done
            ? "You're all set. Taking you home\u2026"
            : "Choose a new password for your account."}
        </p>

        {!done && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
            <div>
              <label className="block mb-2" style={labelStyle}>
                New password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block mb-2" style={labelStyle}>
                Confirm password
              </label>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
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
              {loading ? "Updating\u2026" : "Update password"}
            </button>
          </form>
        )}
      </div>

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
