"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeckForSession } from "../../lib/deck";
import { upsertProfilePreferences, syncBehavioralSignalsToSupabase, fetchOrCreateProfile } from "../../lib/supabase-profile";
import type { Profile } from "../../lib/supabase";
import type { SessionVibeMode } from "../../lib/scoring";
import {
  hasCompletedOnboarding,
  savePreferences,
  markOnboardingDone,
  type UserPreferences,
} from "../../lib/storage";
import { trackEvent } from "../../lib/analytics";
import { SessionTerminalScreen } from "../../../components/SessionTerminalScreen";
import Avatar from "../../components/Avatar";

// ── Lightweight guest setup data ──────────────────────────────────────────────

const GUEST_CUISINES = [
  { label: "Italian", emoji: "🍝" },
  { label: "Mexican", emoji: "🌮" },
  { label: "Asian", emoji: "🥢" },
  { label: "American", emoji: "🍔" },
  { label: "Mediterranean", emoji: "🫒" },
  { label: "Japanese", emoji: "🍱" },
  { label: "Indian", emoji: "🍛" },
  { label: "Middle Eastern", emoji: "🧆" },
];

const GUEST_DIETARY_RESTRICTIONS = [
  { label: "Vegetarian", emoji: "🥦" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Gluten-free", emoji: "🌾" },
  { label: "Dairy-free", emoji: "🥛" },
  { label: "Halal", emoji: "☪️" },
  { label: "Kosher", emoji: "✡️" },
  { label: "None of these", emoji: "✓" },
];

const GUEST_HARD_NOS = [
  { label: "Seafood", emoji: "🦐" },
  { label: "Dairy", emoji: "🧀" },
  { label: "Gluten / Pasta", emoji: "🌾" },
  { label: "Beef", emoji: "🥩" },
  { label: "Pork", emoji: "🐷" },
  { label: "Chicken", emoji: "🍗" },
  { label: "None of these", emoji: "✓" },
];

// ── Host flow constants ───────────────────────────────────────────────────────

const VIBE_OPTIONS: { value: SessionVibeMode; emoji: string; label: string; description: string }[] = [
  { value: "comfort-food", emoji: "🔥", label: "Comfort me", description: "The good stuff. Familiar, satisfying." },
  { value: "quick-easy", emoji: "⚡", label: "Keep it easy", description: "Quick, simple, no-fuss." },
  { value: "mix-it-up", emoji: "✨", label: "Surprise us", description: "Something neither of you expected." },
  { value: "healthy", emoji: "🥗", label: "Healthy reset", description: "Light, fresh, feels good." },
  { value: "something-new", emoji: "🎉", label: "Celebrate something", description: "Special occasion energy." },
];

const VIBE_COLORS: Record<SessionVibeMode, string> = {
  "comfort-food":  "#E8621A",
  "quick-easy":    "#C9983A",
  "mix-it-up":     "#9B70D4",
  "healthy":       "#3DAA72",
  "something-new": "#C9983A",
};

const vibeEmoji: Record<string, string> = Object.fromEntries(
  VIBE_OPTIONS.map((o) => [o.value, o.emoji])
);
const vibeName: Record<string, string> = Object.fromEntries(
  VIBE_OPTIONS.map((o) => [o.value, o.label])
);

const WAITING_HEADLINES = [
  "The hard part\nis deciding.",
  "At least you'll\nagree on something.",
  "Better than\nfighting over it.",
  "Two people.\nOne answer.",
  "No more\n\"I don't care.\"",
];

type ViewerRole = "host" | "guest" | "full" | "unknown";

const POLL_INTERVAL_MS = 3000;

const BUILD_PHRASES = [
  "Finding what you'll both actually want...",
  "Filtering out the hard nos...",
  "Building your deck...",
  "Almost there...",
];

// ── Shared style helpers ──────────────────────────────────────────────────────

const gradientPrimary: React.CSSProperties = {
  background: "linear-gradient(180deg, #FF8A3D, #E8621A 50%, #B84A12)",
  boxShadow:
    "0 1px 0 rgba(255,210,170,0.45) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 16px 34px rgba(232,98,26,0.42), 0 0 0 1px rgba(232,98,26,0.32)",
};

const glassSurface: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,231,202,0.07), rgba(255,231,202,0.02))",
  border: "1px solid rgba(245,237,224,0.16)",
  borderRadius: 22,
  backdropFilter: "blur(20px)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 38px rgba(0,0,0,0.4)",
};

const ghostBtn: React.CSSProperties = {
  background: "rgba(255,231,202,0.045)",
  border: "1px solid rgba(245,237,224,0.16)",
};

const darkBtn: React.CSSProperties = {
  background: "rgba(255,231,202,0.03)",
  border: "1px solid rgba(245,237,224,0.085)",
};

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ViewerRole>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionMatched, setSessionMatched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [inviteDispatched, setInviteDispatched] = useState(false);
  const [joining, setJoining] = useState(false);
  const [buildingDeck, setBuildingDeck] = useState(false);
  const [buildPhrase, setBuildPhrase] = useState(0);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<SessionVibeMode>("mix-it-up");

  // Host flow state
  const [hostStep, setHostStep] = useState<"sharing" | "waiting">("sharing");
  // false = re-entry (skip intro steps); true = first-time host flow
  const [hostNeedsOnboarding, setHostNeedsOnboarding] = useState(true);
  const [showStartSwiping, setShowStartSwiping] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [waitingHeadlineIdx, setWaitingHeadlineIdx] = useState(0);
  const [savingVibe, setSavingVibe] = useState(false);

  // Guard so generateDeckIfNeeded only fires once per session load
  const deckTriggeredRef = useRef(false);
  // Guard so loadSession polling never resets a vibe the user has already selected
  const vibeInitializedRef = useRef(false);
  // Tracks whether this is the first successful loadSession call (re-entry detection)
  const firstSessionLoadRef = useRef(true);
  // Tracks the previous session status so we can detect live transitions
  const previousSessionStatusRef = useRef<string | null>(null);

  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  // Targeted invite recipient — set when the host has an outbound pending invite for this session.
  // null = no pending targeted invite (generic waiting-room copy shown instead).
  const [targetedInviteUser, setTargetedInviteUser] = useState<{
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  // Guest quick-setup state (null = not yet checked)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState<"intro" | "cuisines" | "dietary" | "hardNos">("intro");
  const [guestCuisines, setGuestCuisines] = useState<string[]>([]);
  const [guestDietaryRestrictions, setGuestDietaryRestrictions] = useState<string[]>([]);
  const [guestHardNos, setGuestHardNos] = useState<string[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefer the short code URL; fall back to UUID path if code is absent (older rows)
  const sessionUrl =
    typeof window !== "undefined"
      ? session?.session_code
        ? `${window.location.origin}/join/${session.session_code}`
        : `${window.location.origin}/session/${sessionId}`
      : "";

  // Load session and determine role
  const loadSession = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !data) {
      setError("Session not found or has expired.");
      return;
    }

    const s = data as Session;

    // Enforce expiry: if expires_at has passed and session is not terminal, mark it
    const now = new Date();
    if (s.status !== "expired" && s.status !== "matched" && new Date(s.expires_at) <= now) {
      void supabase
        .from("sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .not("status", "in", '("expired","matched")');
      s.status = "expired";
    }
    if (s.status === "expired") {
      if (typeof window !== "undefined") localStorage.removeItem("wwe_active_session");
      setSessionExpired(true);
      setSession(s);
      return;
    }

    if (s.status === "matched") {
      if (typeof window !== "undefined") localStorage.removeItem("wwe_active_session");
      setSessionMatched(true);
      setSession(s);
      return;
    }

    setSession(s);

    const myId = getUserId();

    if (myId === s.host_user_id) {
      setRole("host");
      // Only initialize selectedVibe once — don't let polls reset what the user picked
      if (s.vibe && !vibeInitializedRef.current) {
        setSelectedVibe(s.vibe as SessionVibeMode);
        vibeInitializedRef.current = true;
      }
      // Re-entry detection: if status is already swiping, skip intro flow
      if (s.status === "swiping") {
        setHostNeedsOnboarding(false);
      }
      // If guest already joined when host loads (status ready/active),
      // jump directly to the waiting step to avoid a vibe-selector flash.
      // On re-entry (first load with guest already connected), skip the 2s animation
      // and show the CTA immediately. On live waiting→ready transitions, leave
      // prevBothConnectedRef alone so the bothConnected effect runs the 2s timer.
      if (s.status === "ready" || s.status === "active") {
        setHostStep("waiting");
        if (firstSessionLoadRef.current) {
          setShowStartSwiping(true);
        }
      }

      // Fetch the host's outbound pending invite so the waiting room can display
      // the targeted recipient's name/avatar instead of generic copy.
      // Only query when session is waiting — once a guest joins, this is irrelevant.
      if (s.status === "waiting") {
        const { data: invite } = await supabase
          .from("session_invites")
          .select("to_user_id")
          .eq("session_id", sessionId)
          .eq("from_user_id", myId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invite?.to_user_id) {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("user_id", invite.to_user_id)
              .single();
            setTargetedInviteUser(
              profileData
                ? { displayName: profileData.display_name ?? null, avatarUrl: profileData.avatar_url ?? null }
                : null,
            );
          } catch {
            // Profile lookup failed — fall back to generic waiting-room copy
            setTargetedInviteUser(null);
          }
        } else {
          // No pending invite (Path A / link share, or invite was dismissed/expired)
          setTargetedInviteUser(null);
        }
      } else {
        // Guest joined or session advanced — clear targeted invite state
        setTargetedInviteUser(null);
      }
    } else if (myId === s.guest_user_id) {
      setRole("guest");
    } else if (s.guest_user_id !== null) {
      setRole("full");
    } else {
      setRole("unknown");
      // First time landing here as a new guest — check if setup is needed.
      setNeedsSetup((prev) => {
        if (prev !== null) return prev; // don't overwrite once decided
        return !hasCompletedOnboarding();
      });
    }

    // Track status across polls for transition detection; mark first load done
    previousSessionStatusRef.current = s.status;
    firstSessionLoadRef.current = false;
  }, [sessionId]);

  // Generates the shared deck from both users' profiles and stores it on the
  // session row. Safe to call from either participant — the DB guard
  // (deck_meal_ids IS NULL) ensures only one deck is ever written.
  const generateDeckIfNeeded = useCallback(
    async (currentSession: Session) => {
      if (!currentSession.guest_user_id) return; // guest hasn't joined yet
      if (currentSession.deck_meal_ids?.length) return; // deck already built
      if (deckTriggeredRef.current) return; // already in progress on this client

      deckTriggeredRef.current = true;

      try {
        const mealIds = await buildSharedDeckForSession(
          currentSession.id,
          currentSession.host_user_id,
          currentSession.guest_user_id,
        );

        // Advance status to swiping — idempotent if another client already did this
        await supabase
          .from("sessions")
          .update({ status: "swiping", updated_at: new Date().toISOString() })
          .eq("id", currentSession.id)
          .in("status", ["ready", "active"]); // only transition forward

        setSession((prev) =>
          prev ? { ...prev, deck_meal_ids: mealIds, status: "swiping" } : prev,
        );
      } catch (err) {
        console.error("[session] deck generation failed:", err);
        // Reset so polling can retry
        deckTriggeredRef.current = false;
      }
    },
    [], // sessionId is stable; no deps needed
  );

  // Guest joins the session
  const joinSession = useCallback(async () => {
    setJoining(true);
    const myId = getUserId();

    const { data, error: joinError } = await supabase
      .from("sessions")
      .update({
        guest_user_id: myId,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .is("guest_user_id", null) // only join if slot is still open
      .select()
      .single();

    if (joinError || !data) {
      // Slot may have just been taken — reload to show "full" state
      await loadSession();
      setJoining(false);
      return;
    }

    const s = data as Session;
    setSession(s);
    setRole("guest");
    setJoining(false);

    // Expire any other pending invites for this session so other recipients'
    // banners stop showing as joinable now that the slot is filled.
    void supabase
      .from("session_invites")
      .update({ status: "expired" })
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .neq("to_user_id", myId);

    // Write wwe_active_session now so the home banner can surface a resume option
    // if the guest goes back before tapping Start Swiping.
    // Overwrite only if missing, expired, malformed, or pointing to a different session.
    if (typeof window !== "undefined") {
      let shouldWrite = true;
      const existingRaw = localStorage.getItem("wwe_active_session");
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          const expiresAt = existing?.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
          const isSameSession = existing?.sessionId === s.id;
          const isNotExpired = expiresAt > Date.now();
          shouldWrite = !(isSameSession && isNotExpired);
        } catch { shouldWrite = true; }
      }
      if (shouldWrite) {
        localStorage.setItem("wwe_active_session", JSON.stringify({
          sessionId: s.id,
          sessionCode: s.session_code ?? null,
          expiresAt: s.expires_at,
          status: s.status,  // "ready" at this point; handleStartSwiping will update to "swiping"
          vibe: s.vibe ?? "mix-it-up",
        }));
      }
    }

    syncBehavioralSignalsToSupabase(myId).catch((err) =>
      console.warn("[sync] behavioral signals failed:", err),
    );
    trackEvent("shared_session_joined", { sessionId });
  }, [sessionId, loadSession]);

  // Initial load
  useEffect(() => {
    loadSession();
    fetchOrCreateProfile(getUserId()).then(setMyProfile).catch(() => {});
  }, [loadSession]);

  // Auto-join if guest slot is open — only after setup is confirmed not needed
  useEffect(() => {
    if (role === "unknown" && session && !joining && needsSetup === false) {
      joinSession();
    }
  }, [role, session, joining, needsSetup, joinSession]);

  // Cycle through build phrases while deck is generating
  useEffect(() => {
    if (!buildingDeck) return;
    setBuildPhrase(0);
    const interval = setInterval(() => {
      setBuildPhrase((p) => (p + 1) % BUILD_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [buildingDeck]);

  // Auto-trigger deck generation when both are ready.
  // Fires on both host and guest — deckTriggeredRef ensures at most one attempt per client;
  // the DB guard (deck_meal_ids IS NULL) ensures only one deck is ever written.
  // For guests, setBuildingDeck(false) is delayed to enforce a minimum 3s animation display.
  useEffect(() => {
    if (session?.status !== "ready") return;
    if (deckTriggeredRef.current) return;
    if (!session) return;

    syncBehavioralSignalsToSupabase(getUserId()).catch((err) =>
      console.warn("[sync] behavioral signals failed:", err),
    );

    const isGuest = role === "guest";
    const startTime = Date.now();
    setBuildingDeck(true);
    generateDeckIfNeeded(session).finally(() => {
      if (isGuest) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => setBuildingDeck(false), remaining);
      } else {
        setBuildingDeck(false);
      }
    });
  }, [session?.status, generateDeckIfNeeded, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for changes
  useEffect(() => {
    const shouldPoll =
      (role === "host" && (session?.status === "waiting" || session?.status === "ready")) ||
      ((role === "host" || role === "guest") && !(session?.deck_meal_ids?.length));

    if (shouldPoll) {
      pollRef.current = setInterval(loadSession, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [role, session?.status, session?.deck_meal_ids, loadSession]);

  // Detect guest join from any host step (vibe, sharing, or waiting).
  // Auto-advances hostStep to "waiting" so the celebration UI renders,
  // then shows "Start swiping →" after 2s.
  const bothConnected =
    session?.status === "ready" ||
    session?.status === "active" ||
    session?.status === "swiping" ||
    session?.status === "matched";

  const prevBothConnectedRef = useRef(false);
  useEffect(() => {
    if (!bothConnected || prevBothConnectedRef.current) return;
    if (role !== "host") return;
    prevBothConnectedRef.current = true;
    setHostStep("waiting");
    const timer = setTimeout(() => setShowStartSwiping(true), 2000);
    return () => clearTimeout(timer);
  }, [bothConnected, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotate waiting headlines every 2.5s
  useEffect(() => {
    if (role !== "host" || hostStep !== "waiting" || bothConnected) return;
    const interval = setInterval(() => {
      setWaitingHeadlineIdx((i) => (i + 1) % WAITING_HEADLINES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [role, hostStep, bothConnected]);

  function handleCopy() {
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true);
      setInviteDispatched(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(false);
    });
  }

  // Saves guest preferences locally AND to Supabase (so deck generation can
  // read them immediately). Awaited before setNeedsSetup to guarantee the
  // profile row exists when buildSharedDeckForSession fires.
  async function completeGuestSetup() {
    setCompletingSetup(true);
    const prefs: UserPreferences = {
      cuisines: guestCuisines,
      dietaryRestrictions: guestDietaryRestrictions.filter((f) => f !== "None of these"),
      hardNoFoods: guestHardNos.filter((f) => f !== "None of these"),
      spiceLevel: "any",
      cookOrOrder: "either",
      kidFriendly: null,
    };
    savePreferences(prefs);
    markOnboardingDone();
    // Sync to Supabase before joining so deck generation can read this profile
    await upsertProfilePreferences(getUserId(), {
      cuisines: prefs.cuisines,
      dietaryRestrictions: prefs.dietaryRestrictions,
      hardNoFoods: prefs.hardNoFoods,
    });
    setCompletingSetup(false);
    setNeedsSetup(false);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Watcha session",
          text: "Help me pick what we're eating tonight",
          url: sessionUrl,
        });
        setJustShared(true);
        setInviteDispatched(true);
        setTimeout(() => setJustShared(false), 3000);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // user cancelled — no action
        }
        handleCopy(); // genuine failure — fall back to copy
      }
    } else {
      handleCopy();
    }
  }

  async function handleVibeSelect(vibe: SessionVibeMode | null) {
    if (vibe) {
      setSavingVibe(true);
      setSelectedVibe(vibe);
      vibeInitializedRef.current = true;
      await supabase
        .from("sessions")
        .update({ vibe, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      setSession((prev) => prev ? { ...prev, vibe } : prev);
      setSavingVibe(false);
    }
    setHostStep("sharing");
  }

  async function handleCancelSession() {
    setCancellingSession(true);
    await supabase
      .from("sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
    }
    router.push("/");
  }

  function handleStartSwiping() {
    // Update localStorage so the home banner knows we're swiping
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wwe_active_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.setItem("wwe_active_session", JSON.stringify({ ...parsed, status: "swiping" }));
        } catch {}
      } else {
        // Joining guest (or auth user) never had this key — write it now so
        // the home banner can surface a resume option if they leave mid-swipe.
        localStorage.setItem("wwe_active_session", JSON.stringify({
          sessionId,
          sessionCode: session?.session_code ?? null,
          createdAt: new Date().toISOString(),
          expiresAt: session?.expires_at ?? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          status: "swiping",
          vibe: session?.vibe ?? "mix-it-up",
        }));
      }
    }
    const vibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;
    trackEvent("shared_deck_started", { sessionId, vibe });
    // Hard nav: consistent with the shared-reset flow; ensures /deck mounts fresh
    // with no stale component state from a prior visit.
    window.location.href = `/deck?sessionId=${sessionId}&vibe=${vibe}`;
  }

  // ── Guest quick setup ─────────────────────────────────────────────────────
  if (role === "unknown" && needsSetup === true) {
    const toggleMulti = (value: string, current: string[], set: (v: string[]) => void) => {
      if (value === "None of these") {
        set(current.includes("None of these") ? [] : ["None of these"]);
        return;
      }
      const without = current.filter((v) => v !== "None of these");
      set(without.includes(value) ? without.filter((v) => v !== value) : [...without, value]);
    };

    const canAdvance =
      setupStep === "intro"
        ? true
        : setupStep === "cuisines"
        ? guestCuisines.length > 0
        : setupStep === "dietary"
        ? guestDietaryRestrictions.length > 0
        : guestHardNos.length > 0;

    async function advanceSetup() {
      if (setupStep === "intro") setSetupStep("cuisines");
      else if (setupStep === "cuisines") setSetupStep("dietary");
      else if (setupStep === "dietary") setSetupStep("hardNos");
      else await completeGuestSetup();
    }

    const stepNum = setupStep === "intro" ? 0 : setupStep === "cuisines" ? 1 : setupStep === "dietary" ? 2 : 3;

    // ── Intro screen ────────────────────────────────────────────────────────
    if (setupStep === "intro") {
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
            }}
          />
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28">
            <div className="pt-10">
              <p
                className="uppercase mb-5"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: "2.4px",
                  color: "#E8621A",
                }}
              >
                Real quick
              </p>
              <h1
                className="leading-tight text-white"
                style={{
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                  fontSize: 44,
                }}
              >
                You&apos;re joining a dinner session<span style={{ color: "#E8621A" }}>.</span>
              </h1>
              <p
                className="mt-3"
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 300,
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "#C7BDAC",
                }}
              >
                Set a few quick preferences, then you&apos;ll both swipe the same deck.
              </p>
              <div className="mt-7 flex flex-col">
                {[
                  { title: "Takes 30 seconds.", subtitle: "Your answers make tonight's picks way better for both of you." },
                  { title: "No sign-up required.", subtitle: "Just set your preferences and you're in." },
                  { title: "We build the deck together.", subtitle: "Your preferences + theirs = a deck you'll both actually want." },
                  { title: "Your swipes stay private.", subtitle: "We only share the match." },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-[18px] py-[18px]"
                    style={{
                      borderBottom: index < 3 ? "1px solid rgba(245,237,224,0.085)" : "none",
                    }}
                  >
                    <span
                      className="flex-shrink-0 w-[30px] leading-none pt-0.5"
                      style={{
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        fontSize: 24,
                        color: "#E8621A",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p
                        className="text-white"
                        style={{
                          fontFamily: "var(--font-quicksand)",
                          fontWeight: 700,
                          fontSize: 19,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        className="mt-1.5"
                        style={{
                          fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                          fontWeight: 300,
                          fontSize: 13.5,
                          lineHeight: 1.5,
                          color: "#C7BDAC",
                        }}
                      >
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="mx-auto w-full max-w-md px-5 pt-10 relative" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#0B0805]" />
              <button
                onClick={advanceSetup}
                className="w-full rounded-full py-[18px] text-center text-[15px] font-bold text-white transition active:scale-[0.99]"
                style={gradientPrimary}
              >
                Let&apos;s do it →
              </button>
            </div>
          </div>
        </main>
      );
    }

    // ── Choice steps (cuisines / dietary / hard NOs) ─────────────────────────
    const choiceData =
      setupStep === "cuisines"
        ? GUEST_CUISINES
        : setupStep === "dietary"
        ? GUEST_DIETARY_RESTRICTIONS
        : GUEST_HARD_NOS;

    const selectedValues =
      setupStep === "cuisines"
        ? guestCuisines
        : setupStep === "dietary"
        ? guestDietaryRestrictions
        : guestHardNos;

    const setSelected =
      setupStep === "cuisines"
        ? setGuestCuisines
        : setupStep === "dietary"
        ? setGuestDietaryRestrictions
        : setGuestHardNos;

    return (
      <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] text-white">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />
        {/* pb-40 (160px) ensures last option clears the sticky CTA on all viewports,
            accounting for: CTA gradient (40px) + button (~54px) + safe-area inset (≤34px)
            + iOS Safari browser toolbar (≤50px) = ~178px worst case. */}
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-40">

          <div className="flex flex-col gap-6 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              {setupStep !== "cuisines" ? (
                <button
                  onClick={() => {
                    if (setupStep === "hardNos") setSetupStep("dietary");
                    else setSetupStep("cuisines");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition active:scale-[0.98]"
                >
                  ←
                </button>
              ) : (
                <div className="w-10" />
              )}
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: "2px",
                  color: "#897E73",
                }}
              >
                Quick setup
              </span>
              <div className="w-10" />
            </div>

            {/* Progress bar */}
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-[4px] flex-1 overflow-hidden rounded-full"
                  style={{ background: "rgba(255,231,202,0.08)" }}
                >
                  {n <= stepNum && (
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #B84A12, #E8621A)",
                        boxShadow: "0 0 8px rgba(232,98,26,0.5)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Question */}
            <div className="mt-2">
              <p
                className="uppercase"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: "2px",
                  color: "#897E73",
                }}
              >
                {stepNum} of 3
              </p>
              <h1
                className="mt-3 text-white leading-tight"
                style={{
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                  fontSize: 38,
                  letterSpacing: "-0.02em",
                }}
              >
                {setupStep === "cuisines" && "What are you down for?"}
                {setupStep === "dietary" && "Any dietary restrictions?"}
                {setupStep === "hardNos" && "Anything you absolutely won't eat?"}
              </h1>
              <p
                className="mt-2"
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 300,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#C7BDAC",
                }}
              >
                {setupStep === "cuisines" && "Pick everything that sounds good to you."}
                {setupStep === "dietary" && "We'll never show you meals that don't work for you."}
                {setupStep === "hardNos" && "Hard NOs are never shown. Ever."}
              </p>
            </div>

            {/* Select all / Deselect all — cuisine step only */}
            {setupStep === "cuisines" && (
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    guestCuisines.length === GUEST_CUISINES.length
                      ? setGuestCuisines([])
                      : setGuestCuisines(GUEST_CUISINES.map((c) => c.label))
                  }
                  style={{
                    fontFamily: "var(--font-quicksand)",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#E8621A",
                  }}
                >
                  {guestCuisines.length === GUEST_CUISINES.length ? "Deselect all" : "Select all"}
                </button>
              </div>
            )}

            {/* Options */}
            <div className="flex flex-col gap-3">
              {choiceData.map((item) => {
                const selected = selectedValues.includes(item.label);
                return (
                  <button
                    key={item.label}
                    onClick={() => toggleMulti(item.label, selectedValues, setSelected)}
                    className="flex items-center gap-4 rounded-[18px] p-4 transition-all duration-150 active:scale-[0.99]"
                    style={
                      selected
                        ? {
                            border: "1.5px solid #E8621A",
                            background: "rgba(232,98,26,0.07)",
                            boxShadow: "0 0 26px rgba(232,98,26,0.12)",
                          }
                        : {
                            border: "1px solid rgba(245,237,224,0.085)",
                            background: "rgba(255,231,202,0.045)",
                          }
                    }
                  >
                    <div
                      className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                      style={{
                        background: "rgba(255,231,202,0.08)",
                        border: "1px solid rgba(245,237,224,0.085)",
                      }}
                    >
                      {item.emoji}
                    </div>
                    <span
                      className="flex-1 text-white text-left"
                      style={{
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {item.label}
                    </span>
                    <div
                      className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center"
                      style={
                        selected
                          ? {
                              background: "#E8621A",
                              boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                            }
                          : {
                              border: "2px solid rgba(245,237,224,0.16)",
                            }
                      }
                    >
                      {selected && (
                        <span className="text-[13px] font-bold text-white">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto w-full max-w-md px-5 pt-10 relative" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#0B0805]" />
            <button
              onClick={advanceSetup}
              disabled={!canAdvance || completingSetup}
              className="w-full rounded-full py-[18px] text-center text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-30"
              style={canAdvance && !completingSetup ? gradientPrimary : { background: "#E8621A" }}
            >
              {completingSetup ? "Joining…" : setupStep === "hardNos" ? "Join session" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!session && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0805] text-white">
        <div className="flex flex-col items-center gap-4">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8621A]/60 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E8621A]/80" />
          </span>
          <p
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontSize: 14,
              color: "#897E73",
            }}
          >
            Loading session…
          </p>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0B0805] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div
            className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(232,98,26,0.08)" }}
          />
        </div>
        <div
          className="w-20 h-20 rounded-[20px] bg-[#E8621A]/10 flex items-center justify-center"
          style={{ boxShadow: "0 0 40px rgba(232,98,26,0.18)" }}
        >
          <span
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 36,
              color: "#E8621A",
            }}
          >
            !
          </span>
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 24,
              color: "#F6EEE2",
            }}
          >
            Something went wrong
          </p>
          <p
            className="mt-2 max-w-[28ch] mx-auto"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 300,
              fontSize: 14,
              color: "#897E73",
            }}
          >
            {error}
          </p>
        </div>
        <Link
          href="/"
          className="w-full max-w-xs rounded-full px-6 py-4 text-center text-sm text-white transition hover:opacity-80 active:scale-[0.99]"
          style={ghostBtn}
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Session expired ───────────────────────────────────────────────────────
  if (sessionExpired || session?.status === "expired") {
    return <SessionTerminalScreen variant="expired" />;
  }

  // ── Session already matched ───────────────────────────────────────────────
  if (sessionMatched) {
    return <SessionTerminalScreen variant="matched" />;
  }

  // ── Session full ──────────────────────────────────────────────────────────
  if (role === "full") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0B0805] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div
            className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(232,98,26,0.08)" }}
          />
        </div>
        <div
          className="w-20 h-20 rounded-[20px] bg-[#E8621A]/10 flex items-center justify-center"
          style={{ boxShadow: "0 0 40px rgba(232,98,26,0.18)" }}
        >
          <span className="text-3xl">🔒</span>
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 24,
              color: "#F6EEE2",
            }}
          >
            Session is full
          </p>
          <p
            className="mt-2 max-w-[28ch] mx-auto leading-relaxed"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 300,
              fontSize: 14,
              color: "#897E73",
            }}
          >
            Looks like someone else grabbed that spot first. Ask your friend to send a new invite.
          </p>
        </div>
        <Link
          href="/"
          className="w-full max-w-xs rounded-full px-6 py-4 text-center text-sm text-white transition hover:opacity-80 active:scale-[0.99]"
          style={ghostBtn}
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Guest: waiting for deck to build ────────────────────────────────────
  if (role === "guest" && !(session?.deck_meal_ids?.length)) {
    const codeDisplay = session?.session_code ?? "…";

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0B0805] flex flex-col items-center justify-center px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
          style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
        >
          ←
        </Link>

        <p
          className="uppercase mb-12"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            color: "#897E73",
          }}
        >
          Shared session
        </p>

        <div className="relative flex items-center justify-center w-32 h-32">
          <div className="absolute w-32 h-32 rounded-full border border-[#E8621A]/20" style={{ animation: "ping 2.5s cubic-bezier(0,0,0.2,1) infinite" }} />
          <div className="absolute w-24 h-24 rounded-full border border-[#E8621A]/30 animate-pulse" />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(232,98,26,0.15)",
              boxShadow: "0 0 24px rgba(232,98,26,0.2)",
            }}
          >
            <span className="text-2xl">👥</span>
          </div>
        </div>

        {session?.vibe && vibeEmoji[session.vibe] && (
          <div
            className="flex items-center gap-2 mt-4 rounded-full px-4 py-2"
            style={{
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
            }}
          >
            <span className="text-lg">{vibeEmoji[session.vibe]}</span>
            <span
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontSize: 13,
                color: "#897E73",
              }}
            >
              Tonight feels like:{" "}
              <span className="text-white font-semibold">{vibeName[session.vibe]}</span>
            </span>
          </div>
        )}

        <h1
          className="text-white mt-8 leading-tight"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 32,
          }}
        >
          Your host is deciding with you.
        </h1>
        <p
          className="mt-3 max-w-xs"
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#C7BDAC",
          }}
        >
          Hang tight. Building a deck for both of you.
        </p>

        {/* Premium waiting pill */}
        <div
          className="flex items-center gap-[9px] rounded-full px-[18px] py-[10px] mt-6"
          style={{
            background: "rgba(255,231,202,0.045)",
            border: "1px solid rgba(245,237,224,0.085)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#E8621A", boxShadow: "0 0 8px rgba(232,98,26,0.5)" }}
          />
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11,
              letterSpacing: "2px",
              color: "#C7BDAC",
            }}
          >
            Building your deck...
          </span>
        </div>

        {/* Glass session code card */}
        {codeDisplay && (
          <div
            className="mt-6 w-full max-w-[260px] rounded-[20px] px-6 py-4 text-center relative"
            style={glassSurface}
          >
            {/* Ember top glow line */}
            <div
              className="absolute inset-x-5 top-0 h-[1.5px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #FF8A3D 30%, #E8621A 50%, #FF8A3D 70%, transparent)",
                boxShadow: "0 0 14px rgba(232,98,26,0.5)",
              }}
            />
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 10,
                letterSpacing: "3px",
                color: "#897E73",
              }}
            >
              Code
            </p>
            <p
              className="mt-2 text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: "-0.01em",
              }}
            >
              {codeDisplay}
            </p>
          </div>
        )}

        <Link
          href="/"
          className="mt-10 transition hover:opacity-70"
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontSize: 13,
            color: "rgba(137,126,115,0.5)",
          }}
        >
          Leave session
        </Link>
      </main>
    );
  }

  // ── Guest: deck ready — show intentional entry screen ────────────────────
  if (role === "guest" && !!(session?.deck_meal_ids?.length)) {
    const guestVibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white flex flex-col items-center justify-center px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
          style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
        >
          ←
        </Link>

        <p
          className="uppercase mb-10"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            color: "#897E73",
          }}
        >
          Shared session
        </p>

        {/* Green rings orb */}
        <div className="relative w-[160px] h-[160px] flex items-center justify-center">
          <div
            className="absolute rounded-full animate-pulse-soft"
            style={{
              inset: -14,
              border: "1px solid rgba(94,158,110,0.3)",
              borderRadius: "50%",
            }}
          />
          <div
            className="absolute rounded-full animate-pulse"
            style={{
              inset: 8,
              border: "1px solid rgba(94,158,110,0.6)",
              borderRadius: "50%",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: 30,
              border: "1px solid rgba(94,158,110,1)",
              borderRadius: "50%",
            }}
          />
          <div
            className="w-[96px] h-[96px] rounded-full flex items-center justify-center text-[34px]"
            style={{
              background: "radial-gradient(circle at 42% 34%, rgba(110,150,200,0.4), rgba(40,60,90,0.5) 70%)",
              boxShadow: "0 0 50px rgba(94,158,110,0.18)",
            }}
          >
            👥
          </div>
        </div>

        <h1
          className="text-white mt-6 leading-tight text-center"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: "-0.02em",
          }}
        >
          You&apos;re in. Let&apos;s decide.
        </h1>
        <p
          className="text-center mt-3 max-w-xs"
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#C7BDAC",
          }}
        >
          We&apos;ll use both of your profiles to build your shared deck.
        </p>

        {/* Deck ready pill — green, mono */}
        <div
          className="flex items-center gap-[9px] rounded-full px-[18px] py-[10px] mt-5"
          style={{
            background: "rgba(255,231,202,0.045)",
            border: "1px solid rgba(245,237,224,0.085)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: "#5E9E6E",
              boxShadow: "0 0 8px rgba(94,158,110,0.45)",
            }}
          />
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11,
              letterSpacing: "2px",
              color: "#C7BDAC",
            }}
          >
            Deck ready
          </span>
        </div>

        <button
          onClick={() => {
            trackEvent("shared_deck_started", { sessionId, vibe: guestVibe });
            // Hard nav: ensures /deck mounts fresh with no stale component state
            window.location.href = `/deck?sessionId=${sessionId}&vibe=${guestVibe}`;
          }}
          className="mt-7 w-full max-w-xs text-white font-bold text-base py-4 rounded-full transition hover:opacity-95 active:scale-[0.99]"
          style={gradientPrimary}
        >
          Start swiping
        </button>

        <p
          className="mt-6"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 12,
            color: "rgba(87,78,69,0.8)",
          }}
        >
          Session · {sessionId?.slice(0, 8)}
        </p>
      </main>
    );
  }

  // ── Building deck loading screen (host + guest) ───────────────────────────
  const shouldShowBuildingDeck =
    buildingDeck &&
    (role === "guest" || (role === "host" && (!hostNeedsOnboarding || hostStep === "waiting")));

  if (shouldShowBuildingDeck) {
    const myInitial = myProfile?.display_name?.[0]?.toUpperCase() ?? '?';
    const partnerInitial = "?";

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0B0805] flex flex-col items-center justify-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />
        {/* Concentric rings */}
        <div
          className="relative flex items-center justify-center w-72 h-72"
          style={{ animation: "pulse 3s ease-in-out infinite" }}
        >
          <div className="absolute w-72 h-72 rounded-full border border-[#E8621A]/20" />
          <div className="absolute w-52 h-52 rounded-full border border-[#E8621A]/35" />
          <div className="absolute w-36 h-36 rounded-full border border-[#E8621A]/50" />
          <div className="w-20 h-20 rounded-full bg-[#3D1A00] flex items-center justify-center">
            <span
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 30,
                color: "#E8621A",
              }}
            >
              ?
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center mt-8">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm text-white border-2 border-[#0B0805] z-10 relative"
            style={{
              background: "#E8621A",
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
            }}
          >
            {myInitial}
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm text-white border-2 border-[#0B0805] -ml-3"
            style={{
              background: "rgba(255,231,202,0.08)",
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
            }}
          >
            {partnerInitial}
          </div>
        </div>

        <p
          className="uppercase mt-4"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11,
            letterSpacing: "2px",
            color: "#E8621A",
          }}
        >
          Combining your tastes...
        </p>

        <p
          className="text-white text-center mt-4 leading-tight px-8 transition-opacity duration-500"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 30,
            opacity: 1,
          }}
        >
          {BUILD_PHRASES[buildPhrase]}
        </p>

        <p
          className="text-center mt-3"
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 14,
            color: "#897E73",
          }}
        >
          Filtering out the maybes. Your deck is almost ready.
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors duration-[400ms]"
              style={{ background: i === buildPhrase % 3 ? "#E8621A" : "rgba(255,231,202,0.08)" }}
            />
          ))}
        </div>
      </main>
    );
  }

  // ── Host: sharing screen (vibe already set from home) ───────────────────
  if (role === "host" && hostNeedsOnboarding && hostStep === "sharing") {
    const codeDisplay = session?.session_code ?? "…";

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 pb-10 text-center">

          {/* Back */}
          <Link
            href="/"
            className="absolute top-12 left-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
            style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
          >
            ←
          </Link>

          <p
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11,
              letterSpacing: "2px",
              color: "#897E73",
            }}
          >
            Share your session
          </p>

          <h1
            className="text-white leading-tight"
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 38,
              letterSpacing: "-0.02em",
            }}
          >
            Who&apos;s deciding<br />with you?
          </h1>
          <p
            className="mt-3 max-w-xs"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 300,
              fontSize: 14,
              lineHeight: 1.5,
              color: "#C7BDAC",
            }}
          >
            Send this code or link. They join, you both swipe, and a match picks your dinner.
          </p>

          {/* Read-only vibe pill */}
          {session?.vibe && vibeEmoji[session.vibe] && (
            <div
              className="flex items-center gap-2 mt-4 rounded-full px-4 py-2"
              style={{
                background: "rgba(255,231,202,0.045)",
                border: "1px solid rgba(245,237,224,0.085)",
              }}
            >
              <span className="text-base">{vibeEmoji[session.vibe]}</span>
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontSize: 13,
                  color: "#C7BDAC",
                }}
              >
                Vibe:{" "}
                <span className="text-white font-semibold">{vibeName[session.vibe]}</span>
              </span>
            </div>
          )}

          {/* Glass session code card */}
          <div
            className="mt-8 w-full rounded-[24px] p-6 text-center relative"
            style={glassSurface}
          >
            {/* Ember top glow line */}
            <div
              className="absolute inset-x-5 top-0 h-[1.5px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #FF8A3D 30%, #E8621A 50%, #FF8A3D 70%, transparent)",
                boxShadow: "0 0 14px rgba(232,98,26,0.5)",
              }}
            />
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 10,
                letterSpacing: "3px",
                color: "#897E73",
              }}
            >
              Session code
            </p>
            <p
              className="mt-3 text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 52,
                letterSpacing: "-0.01em",
                lineHeight: 0.9,
                textShadow: "0 0 30px rgba(232,98,26,0.25)",
              }}
            >
              {codeDisplay}
            </p>
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 300,
                fontSize: 12.5,
                color: "#897E73",
              }}
            >
              or share the link below
            </p>
            <div
              className="mt-3 rounded-[14px] px-4 py-3 text-left overflow-hidden"
              style={{
                background: "rgba(255,231,202,0.03)",
                border: "1px solid rgba(245,237,224,0.085)",
              }}
            >
              <p
                className="truncate"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 12,
                  color: "#C7BDAC",
                }}
              >
                {sessionUrl}
              </p>
            </div>
          </div>

          {/* Share actions */}
          <div className="grid grid-cols-2 gap-3 mt-4 w-full">
            <button
              onClick={handleShare}
              className="w-full text-white font-bold text-[15px] py-4 rounded-full transition hover:opacity-95 active:scale-[0.99]"
              style={gradientPrimary}
            >
              {justShared ? "Shared ✓" : "Share link"}
            </button>
            <button
              onClick={handleCopy}
              className="w-full text-white font-bold text-[15px] py-4 rounded-full transition hover:opacity-80 active:scale-[0.99]"
              style={ghostBtn}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>

          {/* Premium waiting pill */}
          <div
            className="flex items-center gap-[9px] rounded-full px-[18px] py-[10px] mt-6"
            style={{
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "#E8621A", boxShadow: "0 0 8px rgba(232,98,26,0.5)" }}
            />
            <span
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 400,
                fontSize: 13,
                color: "#C7BDAC",
              }}
            >
              Waiting for someone to join…
            </span>
          </div>

          {/* Persistent post-invite confirmation */}
          {inviteDispatched && (
            <p
              className="mt-4 text-center leading-snug"
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 400,
                fontSize: 13,
                color: "#897E73",
              }}
            >
              You&apos;re all set.<br />Waiting for them to join.
            </p>
          )}

          {/* Transition to waiting room */}
          <button
            onClick={() => setHostStep("waiting")}
            className="mt-8 transition hover:opacity-60 underline underline-offset-2"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 500,
              fontSize: 13,
              color: "#C7BDAC",
            }}
          >
            I shared it, now what? →
          </button>
        </div>
      </main>
    );
  }

  // ── Host: waiting room ─────────────────────────────────────────────────────
  if (role === "host" && (hostStep === "waiting" || !hostNeedsOnboarding)) {
    const myInitial = myProfile?.display_name?.[0]?.toUpperCase() ?? '?';
    const codeDisplay = session?.session_code ?? "…";
    const deckReady = !!(session?.deck_meal_ids?.length);

    // Sub-state: guest just joined, show "Start swiping →"
    if (bothConnected && showStartSwiping) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
          </div>

          <p
            className="uppercase mb-8"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11,
              letterSpacing: "2px",
              color: "#897E73",
            }}
          >
            They&apos;re in
          </p>

          {/* Two avatar circles, lit up */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white border-2 border-[#E8621A]/40"
                style={{
                  background: "radial-gradient(circle at 40% 32%, #FF8A3D, #E8621A 70%, #B84A12)",
                  boxShadow: "0 0 24px rgba(232,98,26,0.45)",
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                }}
              >
                {myInitial}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "#897E73",
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 500,
                }}
              >
                You
              </span>
            </div>

            {/* Connector */}
            <div className="flex items-center gap-1.5 mb-5">
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white border-2 border-[#4A7C59]/40"
                style={{
                  background: "#4A7C59",
                  boxShadow: "0 0 24px rgba(74,124,89,0.45)",
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "#897E73",
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 500,
                }}
              >
                Joined
              </span>
            </div>
          </div>

          <h1
            className="text-white leading-tight"
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: "-0.02em",
            }}
          >
            Your crew<br />is ready.
          </h1>
          <p
            className="mt-3 max-w-xs"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 300,
              fontSize: 14,
              lineHeight: 1.5,
              color: "#C7BDAC",
            }}
          >
            {deckReady
              ? "Your deck is built. Tap to start swiping — you both need to match on something."
              : "Building your shared deck now. Tap to jump in the moment it's ready."}
          </p>

          <button
            onClick={handleStartSwiping}
            disabled={!deckReady}
            className="mt-10 w-full max-w-xs text-white font-bold text-base py-5 rounded-full transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            style={deckReady ? gradientPrimary : { background: "#E8621A" }}
          >
            {deckReady ? "Start swiping →" : "Building deck…"}
          </button>

          {!deckReady && (
            <div className="flex items-center gap-2 mt-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8621A] animate-pulse" />
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontSize: 12,
                  color: "#897E73",
                }}
              >
                Almost there...
              </span>
            </div>
          )}
        </main>
      );
    }

    // Sub-state: guest joined but 2s animation delay not done yet
    if (bothConnected && !showStartSwiping) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          </div>

          {/* Safety-net escape — timer should fire in 2s but host must never be truly trapped */}
          <Link
            href="/"
            className="absolute top-12 left-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
            style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
          >
            ←
          </Link>

          {/* Two avatar circles, animating in */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white"
                style={{
                  background: "radial-gradient(circle at 40% 32%, #FF8A3D, #E8621A 70%, #B84A12)",
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                }}
              >
                {myInitial}
              </div>
              <span style={{ fontSize: 12, color: "#897E73" }}>You</span>
            </div>

            <div className="flex items-center gap-1.5 mb-5">
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white animate-pulse"
                style={{
                  background: "#4A7C59",
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: 12, color: "#897E73" }}>Joined!</span>
            </div>
          </div>

          <h1
            className="text-white"
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 32,
            }}
          >
            They joined!
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
              fontWeight: 300,
              fontSize: 14,
              color: "#897E73",
            }}
          >
            Get ready...
          </p>
        </main>
      );
    }

    // Sub-state: waiting for guest (full branded waiting room)
    const expiresAt = session?.expires_at ? new Date(session.expires_at) : null;
    const hoursLeft = expiresAt
      ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)))
      : null;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white flex flex-col px-6 pt-12 pb-10">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />

        {/* Back */}
        {hostNeedsOnboarding && (
          <button
            onClick={() => setHostStep("sharing")}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg mb-8 self-start"
            style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)" }}
          >
            ←
          </button>
        )}

        {/* Main content — centered */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">

          {/* Avatar pair — reference size 96px */}
          <div className="flex items-center justify-center gap-0 mt-2">
            <div className="flex flex-col items-center gap-[10px]">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-[38px] text-white"
                style={{
                  background: "radial-gradient(circle at 40% 32%, #FF8A3D, #E8621A 70%, #B84A12)",
                  boxShadow: "0 0 50px rgba(232,98,26,0.5), 0 0 0 6px rgba(232,98,26,0.06)",
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                }}
              >
                {myInitial}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  color: "#C7BDAC",
                }}
              >
                You
              </span>
            </div>

            {/* Dashed connector */}
            <div className="flex items-center gap-2 mx-[18px] mb-5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ background: "rgba(87,78,69,1)" }}
                />
              ))}
            </div>

            <div className="flex flex-col items-center gap-[10px]">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center relative overflow-hidden"
                style={
                  targetedInviteUser
                    ? { background: "rgba(245,237,224,0.06)", border: "2px solid rgba(245,237,224,0.16)" }
                    : {
                        border: "2px dashed rgba(245,237,224,0.16)",
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        fontSize: 34,
                        color: "#897E73",
                      }
                }
              >
                {targetedInviteUser ? (
                  <Avatar
                    avatarUrl={targetedInviteUser.avatarUrl}
                    name={targetedInviteUser.displayName}
                    initialsSize={28}
                    initialsColor="white"
                    silhouetteColor="#897E73"
                    silhouetteSize={32}
                  />
                ) : (
                  "?"
                )}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  color: "#897E73",
                }}
              >
                {targetedInviteUser?.displayName ?? "Waiting…"}
              </span>
            </div>
          </div>

          {/* Rotating headline */}
          <h1
            key={waitingHeadlineIdx}
            className="text-white leading-tight text-center mt-9"
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: "-0.02em",
              animation: "fadeIn 0.4s ease-out",
              whiteSpace: "pre-line",
            }}
          >
            {WAITING_HEADLINES[waitingHeadlineIdx]}
          </h1>

          {/* Glass session code card */}
          <div
            className="mt-7 w-full max-w-[280px] rounded-[20px] px-6 py-5 text-center relative"
            style={glassSurface}
          >
            {/* Ember top glow line */}
            <div
              className="absolute inset-x-5 top-0 h-[1.5px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #FF8A3D 30%, #E8621A 50%, #FF8A3D 70%, transparent)",
                boxShadow: "0 0 14px rgba(232,98,26,0.5)",
              }}
            />
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 10,
                letterSpacing: "3px",
                color: "#897E73",
              }}
            >
              Code
            </p>
            <p
              className="mt-2 text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: "-0.01em",
              }}
            >
              {codeDisplay}
            </p>
          </div>

          {/* Expiry */}
          {hoursLeft !== null && (
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(137,126,115,0.6)",
              }}
            >
              Session expires in {hoursLeft}h
            </p>
          )}

          {/* Premium waiting pill */}
          <div
            className="flex items-center gap-[9px] rounded-full px-[18px] py-[10px] mt-5"
            style={{
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "rgba(232,98,26,0.6)" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#E8621A" }} />
            </span>
            <span
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 400,
                fontSize: 13,
                color: "#C7BDAC",
              }}
            >
              {targetedInviteUser?.displayName
                ? `Waiting for ${targetedInviteUser.displayName} to join…`
                : "Waiting for someone to join"}
            </span>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleShare}
            className="w-full text-white font-bold text-base py-4 rounded-full"
            style={gradientPrimary}
          >
            Resend invite
          </button>
          <button
            onClick={handleCancelSession}
            disabled={cancellingSession}
            className="w-full font-bold text-base py-4 rounded-full transition hover:opacity-70 disabled:opacity-40"
            style={{ ...darkBtn, color: "#897E73" }}
          >
            {cancellingSession ? "Cancelling…" : "Cancel session"}
          </button>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    );
  }

  // ── Fallback (should not normally be reached) ─────────────────────────────
  return null;
}
