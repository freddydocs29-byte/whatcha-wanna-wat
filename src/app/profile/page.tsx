"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import FlameCard from "../components/FlameCard";
import type { FlameCardProps } from "../components/FlameCard";
import {
  getPreferences,
  savePreferences,
  getTasteProfile,
  getHistory,
  getNoveltyBias,
  saveNoveltyBias,
  type UserPreferences,
  type TasteProfile,
  type HistoryEntry,
} from "../lib/storage";
import {
  fetchOrCreateProfile,
  fetchSoftAvoids,
  updateProfileMeta,
  uploadAvatar,
} from "../lib/supabase-profile";
import { detectRituals, type RitualDetection } from "../lib/rituals";
import { getUserId, getAuthUserId, clearAllLocalState, resetAnonymousId } from "../lib/identity";
import { supabase, type SoftAvoid } from "../lib/supabase";
import {
  type SoloDNA,
  type CouplesDNA,
  type PartnerInfo,
} from "../lib/dna";
import { getSoloInsights, getCouplesInsights } from "../lib/dna-insights";
import {
  getFlavorType,
  getBaseTypeLabel,
  type FlavorTypeResult,
  type BaseFlavorType,
} from "../lib/flavor-type";
import { getCompatibilityPairing } from "../lib/compatibility";

// ── Option constants ──────────────────────────────────────────────────────────

const CUISINES = [
  { label: "Italian", emoji: "🍝" },
  { label: "Mexican", emoji: "🌮" },
  { label: "Asian", emoji: "🥢" },
  { label: "American", emoji: "🍔" },
  { label: "Mediterranean", emoji: "🫒" },
  { label: "Japanese", emoji: "🍱" },
  { label: "Indian", emoji: "🍛" },
  { label: "Middle Eastern", emoji: "🧆" },
];

const DISLIKED_FOODS = [
  { label: "Seafood", emoji: "🦐" },
  { label: "Dairy", emoji: "🧀" },
  { label: "Gluten / Pasta", emoji: "🌾" },
  { label: "Beef", emoji: "🥩" },
  { label: "Pork", emoji: "🐷" },
  { label: "Chicken", emoji: "🍗" },
  { label: "None of these", emoji: "✓" },
];

const DIETARY_OPTIONS = [
  { label: "Vegetarian", emoji: "🥦" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Gluten-free", emoji: "🌾" },
  { label: "Dairy-free", emoji: "🥛" },
  { label: "Halal", emoji: "☪️" },
  { label: "Kosher", emoji: "✡️" },
];

const NOVELTY_OPTIONS: { value: number; label: string; desc: string }[] = [
  { value: 0.2, label: "I like what I know",       desc: "Stick to tried and tested" },
  { value: 0.5, label: "Mix of both",               desc: "Some variety, some comfort" },
  { value: 0.8, label: "I love trying new things",  desc: "Surprise me every time" },
];

// ── Category display name map ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "Comfort food": "Comfort",
  "Fresh & Healthy": "Fresh",
  "Crowd-pleasers": "Crowd",
  "Indulgent": "Indulgent",
  "Quick & Easy": "Quick",
  "Adventurous": "Bold",
};

function shortCategory(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.split(" ")[0];
}

/** Returns up to 2 uppercase initials from a display name. */
function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  // ── Sync state (localStorage — available immediately after mount) ──────────
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [noveltyBias, setNoveltyBias] = useState<number>(0.5);

  // ── Auth + profile state ───────────────────────────────────────────────────
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Async state (Supabase) ─────────────────────────────────────────────────
  const [asyncLoading, setAsyncLoading] = useState(true);
  const [softAvoids, setSoftAvoids] = useState<SoftAvoid[]>([]);
  const [rituals, setRituals] = useState<RitualDetection[]>([]);

  // ── DNA state (loaded separately) ─────────────────────────────────────────
  const [dnaLoading, setDnaLoading] = useState(true);
  const [soloDNA, setSoloDNA] = useState<SoloDNA | null>(null);
  const [soloInsights, setSoloInsights] = useState<string[]>([]);
  const [flavorType, setFlavorType] = useState<FlavorTypeResult | null>(null);
  const [couplesDNA, setCouplesDNA] = useState<CouplesDNA | null>(null);
  const [couplesFlavorType, setCouplesFlavorType] = useState<FlavorTypeResult | null>(null);
  const [couplesInsights, setCouplesInsights] = useState<string[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerInfo[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerSoloBaseType, setPartnerSoloBaseType] = useState<BaseFlavorType | null>(null);

  // ── Tracks whether flavorType was pre-populated from localStorage ─────────
  const flavorTypePreloadedRef = useRef(false);

  // ── FlameCard overlay ──────────────────────────────────────────────────────
  const [flameOverlay, setFlameOverlay] = useState<"solo" | "couples" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const flameCardRef = useRef<HTMLDivElement>(null);

  // ── Saved toast ────────────────────────────────────────────────────────────
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dietary / Hard NOs add mode ───────────────────────────────────────────
  const [showAddDietary, setShowAddDietary] = useState(false);
  const [showAddHardNo, setShowAddHardNo] = useState(false);

  useEffect(() => {
    // Sync reads — all available immediately from localStorage.
    setPrefs(getPreferences() ?? {
      cuisines: [],
      dietaryRestrictions: [],
      hardNoFoods: [],
      spiceLevel: "any",
      cookOrOrder: "either",
      kidFriendly: null,
    });
    setTasteProfile(getTasteProfile());
    setHistory(getHistory());
    setNoveltyBias(getNoveltyBias());

    const userId = getUserId();

    // Pre-populate flavorType from localStorage cache to avoid showing "Still
    // learning" when soloDNA is temporarily stale after a fresh reveal.
    const ftCacheKey = `wwe_flavor_type_solo_${userId}`;
    try {
      const ftRaw = localStorage.getItem(ftCacheKey);
      if (ftRaw) {
        const ftCached = JSON.parse(ftRaw) as { result: FlavorTypeResult; decisionCount: number };
        if (ftCached.result?.personalizedName) {
          setFlavorType(ftCached.result);
          flavorTypePreloadedRef.current = true;
        }
      }
    } catch { /* non-fatal */ }

    // ── Identity load (auth + profile + avoids + rituals) ──────────────────
    Promise.all([
      getAuthUserId(),
      fetchOrCreateProfile(userId),
      fetchSoftAvoids(userId),
      detectRituals(userId),
    ])
      .then(([authUid, profile, avoids, _rituals]) => {
        setAuthUserId(authUid);
        if (profile?.display_name) {
          setDisplayName(profile.display_name);
          setNameInput(profile.display_name);
        }
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
        if (profile?.novelty_bias != null) setNoveltyBias(profile.novelty_bias);
        const now = Date.now();
        setSoftAvoids(avoids.filter((sa) => new Date(sa.expiresAt).getTime() > now));
        setRituals(_rituals.filter((r) => r.confidence >= 0.6));
      })
      .catch((err) => console.warn("[profile] identity load error:", err))
      .finally(() => setAsyncLoading(false));

    // ── DNA load (single endpoint, runs in parallel with identity) ────────
    (async () => {
      try {
        const [fetchRes, selfProfile] = await Promise.all([
          fetch(`/api/profile/dna?userId=${encodeURIComponent(userId)}`),
          fetchOrCreateProfile(userId),
        ]);

        if (!fetchRes.ok) throw new Error(`DNA API ${fetchRes.status}`);

        const data = (await fetchRes.json()) as {
          solo: SoloDNA | null;
          couples: CouplesDNA | null;
          soloInsights: null;
          couplesInsights: null;
          partners: PartnerInfo[] | null;
        };

        const allPartners = data.partners ?? [];
        setSoloDNA(data.solo);
        setPartners(allPartners);

        // Insights use localStorage — generate client-side after receiving DNA
        if (data.solo && data.solo.totalDecisions >= 3) {
          const insights = await getSoloInsights(
            data.solo,
            selfProfile?.display_name ?? undefined
          ).catch(() => []);
          setSoloInsights(insights);
        }

        // Flavor type — only reveals after 7 decisions; null below that threshold.
        // Resolution order:
        //   1. localStorage cache (pre-populated synchronously at mount, above)
        //   2. Supabase flavor_types (fallback if cache was cleared)
        //   3. getFlavorType (compute fresh — never overwrites a valid cached value with null)
        if (data.solo) {
          getFlavorType(data.solo, "solo", selfProfile?.display_name ?? undefined, userId)
            .then((result) => {
              if (result !== null) {
                // Fresh or cache-hit result — always use it.
                setFlavorType(result);
              } else if (!flavorTypePreloadedRef.current) {
                // getFlavorType returned null (DNA has < 7 decisions) and localStorage
                // had no cached type. Try Supabase flavor_types as fallback in case
                // the type was generated on another device or the cache was cleared.
                void (async () => {
                  try {
                    const { data: ftRow } = await supabase
                      .from("flavor_types")
                      .select("base_type, personalized_name, tagline, confidence, session_count, updated_at")
                      .eq("user_id", userId)
                      .eq("context", "solo")
                      .single();
                    if (ftRow?.personalized_name && ftRow.base_type) {
                      setFlavorType({
                        baseType: ftRow.base_type as BaseFlavorType,
                        confidence: (ftRow.confidence as number | null) ?? 0,
                        personalizedName: ftRow.personalized_name as string,
                        tagline: (ftRow.tagline as string | null) ?? "",
                        signals: [],
                        assignedAt: (ftRow.updated_at as string | null) ?? new Date().toISOString(),
                        sessionCount: (ftRow.session_count as number | null) ?? 0,
                      });
                    }
                  } catch { /* non-fatal */ }
                })();
              }
              // If result is null AND localStorage was pre-populated, do nothing —
              // keep the pre-populated value; the stale DNA shouldn't erase it.
            })
            .catch(() => { /* non-fatal */ });
        }

        if (allPartners.length > 0) {
          const firstPartner = allPartners[0];
          setSelectedPartnerId(firstPartner.partnerId);
          setPartnerName(firstPartner.displayName);
          setPartnerAvatarUrl(firstPartner.avatarUrl);

          // Fetch partner's solo base type for compatibility pairing
          void (async () => {
            try {
              const { data } = await supabase
                .from("flavor_types")
                .select("base_type")
                .eq("user_id", firstPartner.partnerId)
                .eq("context", "solo")
                .single();
              setPartnerSoloBaseType(
                (data?.base_type as BaseFlavorType | null) ?? null
              );
            } catch { /* non-fatal */ }
          })();

          if (data.couples) {
            setCouplesDNA(data.couples);
            const ci = await getCouplesInsights(
              data.couples,
              selfProfile?.display_name ?? undefined,
              firstPartner.displayName ?? undefined,
              userId,
              firstPartner.partnerId
            ).catch(() => []);
            setCouplesInsights(ci);

            // Couples flavor type — only when 7+ shared accepted matches
            if (data.couples.totalMatchesTogether >= 7) {
              getFlavorType(
                data.couples,
                { partnerId: firstPartner.partnerId },
                selfProfile?.display_name ?? undefined,
                userId
              )
                .then(setCouplesFlavorType)
                .catch(() => { /* non-fatal */ });
            }
          }
        }
      } catch (err) {
        console.warn("[profile] DNA load error:", err);
      } finally {
        setDnaLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preference update helpers ──────────────────────────────────────────────

  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedVisible(true);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1500);
  }

  function update(partial: Partial<UserPreferences>) {
    if (!prefs) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    savePreferences(next);
    flashSaved();
  }

  function toggleCuisine(label: string) {
    if (!prefs) return;
    const next = prefs.cuisines.includes(label)
      ? prefs.cuisines.filter((c) => c !== label)
      : [...prefs.cuisines, label];
    update({ cuisines: next });
  }

  function toggleDisliked(label: string) {
    if (!prefs) return;
    if (label === "None of these") { update({ hardNoFoods: [] }); return; }
    const next = prefs.hardNoFoods.includes(label)
      ? prefs.hardNoFoods.filter((f) => f !== label)
      : [...prefs.hardNoFoods, label];
    update({ hardNoFoods: next });
  }

  function toggleDietary(label: string) {
    if (!prefs) return;
    const current = prefs.dietaryRestrictions ?? [];
    const next = current.includes(label)
      ? current.filter((d) => d !== label)
      : [...current, label];
    update({ dietaryRestrictions: next });
  }

  function selectNoveltyBias(value: number) {
    setNoveltyBias(value);
    saveNoveltyBias(value);
    flashSaved();
  }

  // ── Auth action helpers ────────────────────────────────────────────────────

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    setEditingName(false);
    await updateProfileMeta(getUserId(), { displayName: trimmed });
    flashSaved();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    const userId = getUserId();
    const url = await uploadAvatar(userId, file);
    if (!url) { setAvatarError("Photo didn't upload. Try again."); setAvatarUploading(false); return; }
    const saved = await updateProfileMeta(userId, { avatarUrl: url });
    if (!saved) { setAvatarError("Photo uploaded, but didn't save. Try again."); setAvatarUploading(false); return; }
    setAvatarUrl(url);
    setAvatarUploading(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    clearAllLocalState();
    resetAnonymousId();
    router.push("/");
  }

  // ── Share handler (html2canvas) ────────────────────────────────────────────

  async function handleShare() {
    if (!flameCardRef.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(flameCardRef.current, {
        backgroundColor: "#1C1A18",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) { setShareError("Couldn't share. Try saving the image."); setSharing(false); return; }
        const file = new File([blob], "watcha-flavor-profile.png", { type: "image/png" });
        if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "My Watcha? Flavor Profile" });
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              setShareError("Couldn't share. Try saving the image.");
            }
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "watcha-flavor-profile.png";
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, "image/png");
    } catch {
      setShareError("Couldn't share. Try saving the image.");
      setSharing(false);
    }
  }

  // ── Partner selector ─────────────────────────────────────────────────────

  async function handlePartnerSelect(partnerId: string) {
    if (partnerId === selectedPartnerId) return;
    const partner = partners.find((p) => p.partnerId === partnerId);
    if (!partner) return;
    setSelectedPartnerId(partnerId);
    setPartnerName(partner.displayName);
    setPartnerAvatarUrl(partner.avatarUrl);
    setCouplesDNA(null);
    setCouplesInsights([]);
    setCouplesFlavorType(null);
    setPartnerSoloBaseType(null);

    // Fetch new partner's solo base type for compatibility pairing
    void (async () => {
      try {
        const { data } = await supabase
          .from("flavor_types")
          .select("base_type")
          .eq("user_id", partnerId)
          .eq("context", "solo")
          .single();
        setPartnerSoloBaseType(
          (data?.base_type as BaseFlavorType | null) ?? null
        );
      } catch { /* non-fatal */ }
    })();
    try {
      const uid = getUserId();
      const res = await fetch(
        `/api/profile/dna?userId=${encodeURIComponent(uid)}&partnerId=${encodeURIComponent(partnerId)}`
      );
      if (!res.ok) throw new Error(`DNA API ${res.status}`);
      const data = (await res.json()) as { couples: CouplesDNA | null };
      if (data.couples) {
        setCouplesDNA(data.couples);
        const ci = await getCouplesInsights(
          data.couples,
          displayName || undefined,
          partner.displayName ?? undefined,
          uid,
          partnerId
        ).catch(() => []);
        setCouplesInsights(ci);

        // Couples flavor type — only when 7+ shared accepted matches
        if (data.couples.totalMatchesTogether >= 7) {
          getFlavorType(
            data.couples,
            { partnerId },
            displayName || undefined,
            uid
          )
            .then(setCouplesFlavorType)
            .catch(() => { /* non-fatal */ });
        }
      }
    } catch (err) {
      console.warn("[profile] couples DNA switch error:", err);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const mealsTriedCount = new Set(history.map((e) => e.meal.id)).size;

  const memberSince = (() => {
    if (history.length === 0) return null;
    const oldest = history[history.length - 1];
    return new Date(oldest.chosenAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  // ── DNA derived data ───────────────────────────────────────────────────────

  const soloTopThree = soloDNA?.topCuisines.slice(0, 3) ?? [];
  const soloMaxPct = soloTopThree[0]?.pct ?? 1;
  const activeTags = soloDNA?.flavorTags.filter((t) => t.active).map((t) => t.tag) ?? [];
  const hardNosList = prefs?.hardNoFoods ?? [];

  const couplesTopTwo = couplesDNA?.mutualCuisines.slice(0, 2) ?? [];

  const compatibilityPairing =
    flavorType && partnerSoloBaseType
      ? getCompatibilityPairing(flavorType.baseType, partnerSoloBaseType)
      : null;
  const couplesMaxPct = couplesTopTwo[0]?.pct ?? 1;

  // ── FlameCard props (built for overlay) ───────────────────────────────────

  const soloCardProps: FlameCardProps | null =
    soloDNA && soloDNA.totalDecisions >= 3
      ? {
          mode: "solo",
          userName: displayName || undefined,
          flavorType: flavorType ?? undefined,
          data: {
            totalDecisions: soloDNA.totalDecisions,
            totalSessions: soloDNA.totalSessions,
            topCuisine: soloDNA.topCuisines[0]?.cuisine,
            topCuisinePct: soloDNA.topCuisines[0]?.pct,
            cuisineBreakdown: soloDNA.topCuisines.slice(0, 3),
            flavorTags: activeTags.slice(0, 5),
            hardNos: hardNosList.length ? hardNosList : undefined,
            allTimeNumber1: soloDNA.allTimeNumber1
              ? { mealName: soloDNA.allTimeNumber1.mealName, count: soloDNA.allTimeNumber1.count }
              : undefined,
            fastestMatchSeconds: soloDNA.fastestMatchSeconds,
            currentStreak: soloDNA.currentStreakDays,
            insights: soloInsights,
          },
        }
      : null;

  const couplesCardProps: FlameCardProps | null = couplesDNA
    ? {
        mode: "couples",
        userName: displayName || undefined,
        partnerName: partnerName || undefined,
        data: {
          totalMatchesTogether: couplesDNA.totalMatchesTogether,
          totalSessions: couplesDNA.totalSessionsTogether,
          topCuisine: couplesDNA.mutualCuisines[0]?.cuisine,
          topCuisinePct: couplesDNA.mutualCuisines[0]?.pct,
          cuisineBreakdown: couplesDNA.mutualCuisines.slice(0, 3),
          allTimeNumber1: couplesDNA.allTimeNumber1Together
            ? { mealName: couplesDNA.allTimeNumber1Together.mealName, count: couplesDNA.allTimeNumber1Together.count }
            : undefined,
          fastestMatchSeconds: couplesDNA.fastestMatchTogether,
          insights: couplesInsights,
        },
      }
    : null;

  // ── Guard: single render frame before useEffect fires ─────────────────────

  console.log('[type-reveal] profile type render state:', {
    soloDNADecisions: soloDNA?.totalDecisions,
    hasFlavorType: !!flavorType,
    flavorTypeName: flavorType?.personalizedName,
  });

  if (!prefs) {
    return (
      <div className="min-h-screen bg-[#1C1A18] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
      </div>
    );
  }

  const avatarInitials = initials(displayName || null);

  return (
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      {/* ── Saved toast ──────────────────────────────────────────────────────── */}
      <span
        className={`fixed top-4 right-4 z-50 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs text-white/55 transition-all duration-300 ${
          savedVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Saved
      </span>

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 1 — Identity (keep as-is)
      ────────────────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-2">
        {/* Avatar top right */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => authUserId && avatarInputRef.current?.click()}
                className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display font-black text-lg text-white ${
                  avatarUrl ? "" : "bg-[#E8621A]"
                } ${authUserId ? "cursor-pointer" : "cursor-default"}`}
                title={authUserId ? "Change photo" : undefined}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </button>
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {authUserId && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#E8621A] rounded-full flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-white">✎</span>
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            {avatarError && (
              <p className="text-red-400 text-[10px] font-body text-center leading-tight max-w-[72px]">
                {avatarError}
              </p>
            )}
          </div>
        </div>

        {/* Page headline + name */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-3xl text-white">Profile</h1>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus
                  className="font-body text-sm text-white bg-transparent border-b border-[#E8621A] outline-none flex-1 min-w-0 py-0.5"
                />
                <button onClick={() => void saveName()} className="text-[#E8621A] font-semibold text-sm flex-shrink-0">Save</button>
                <button onClick={() => setEditingName(false)} className="text-[#8A7F78] text-sm flex-shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="font-body text-sm text-[#8A7F78]">
                  {displayName || "You"}{memberSince ? ` · Member since ${memberSince}` : ""} · {history.length} decisions
                </p>
                {authUserId && (
                  <button
                    onClick={() => { setNameInput(displayName); setEditingName(true); }}
                    className="text-[#8A7F78] text-xs flex-shrink-0"
                    title="Edit name"
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>
          <Link
            href="/profile/edit"
            className="bg-[#2A2420] text-white font-body font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 ml-4"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* ── 1b. Auth CTA ──────────────────────────────────────────────────────── */}
      {!asyncLoading && (
        <div className="mx-5 mt-4">
          {authUserId ? (
            <div className="flex items-center justify-between bg-[#2A2420] rounded-[14px] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[#E8621A] text-sm">✓</span>
                <p className="font-body text-sm text-white/70">Account connected</p>
              </div>
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="font-body text-xs text-[#8A7F78] disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="w-full flex items-center justify-between bg-[#2A2420] rounded-[14px] px-4 py-3.5 border border-white/[0.06]"
            >
              <div>
                <p className="font-display font-black text-sm text-white text-left">Create an account</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5 text-left">Sync your profile across devices</p>
              </div>
              <span className="text-[#E8621A] text-lg flex-shrink-0">→</span>
            </button>
          )}
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mx-5 mt-6">
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">{history.length}</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">Decisions</span>
        </div>
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">{mealsTriedCount}</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">Meals tried</span>
        </div>
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">0</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">With others</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 2 — Your Flame (solo DNA)
      ────────────────────────────────────────────────────────────────────── */}
      <div className="px-5 mt-10">
        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-5">
          YOUR FLAME
        </p>

        {dnaLoading ? (
          /* Skeleton */
          <div>
            <div className="h-7 w-52 rounded-full bg-white/[0.06] animate-pulse mb-2" />
            <div className="h-4 w-36 rounded-full bg-white/[0.04] animate-pulse mb-6" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <div className="h-3 w-16 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-[#3D3733] animate-pulse" />
                <div className="h-3 w-8 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : soloDNA && soloDNA.totalDecisions < 3 ? (
          /* Not enough data */
          <div className="flex flex-col items-center text-center py-6">
            <p className="font-display font-black text-2xl text-white leading-snug mb-2">
              Your Flame is still warming up.
            </p>
            <p className="font-body text-sm text-[#8A7F78] leading-relaxed mb-6">
              Make a few more dinner decisions and we'll have something real to say.
            </p>
            <button
              onClick={() => router.push("/")}
              className="font-display font-black text-sm px-6 py-3.5 rounded-full bg-[#E8621A] text-white"
            >
              Go decide →
            </button>
          </div>
        ) : soloDNA ? (
          /* Full flame content */
          <div>
            {/* Flavor type block — shown above cuisine bars.
                flavorType is checked first: if cache already exists (e.g. after a
                reveal that hasn't synced back to totalDecisions yet), show it
                immediately instead of falling through to "Still learning". */}
            {flavorType ? (
              <div className="mb-5">
                <p className="font-display font-black text-2xl text-white leading-tight">
                  {flavorType.personalizedName}
                </p>
                <p className="font-body text-xs text-[#E8621A] mt-0.5">
                  {getBaseTypeLabel(flavorType.baseType)}
                </p>
                <p className="font-body text-sm text-white/70 mt-1">
                  {flavorType.tagline}
                </p>
              </div>
            ) : soloDNA.totalDecisions < 7 ? (
              <div className="mb-5">
                <p className="font-body text-sm text-[#8A7F78]">Still learning you…</p>
                <p className="font-body text-xs text-[#8A7F78]/60 mt-0.5">
                  {7 - soloDNA.totalDecisions}{" "}
                  {7 - soloDNA.totalDecisions === 1 ? "more decision" : "more decisions"} until your type is revealed
                </p>
              </div>
            ) : null}

            {/* Hero */}
            <p className="font-display font-black text-2xl text-white leading-tight">
              {soloDNA.topCuisines[0]?.cuisine ?? "Your taste"} runs the table
            </p>
            {soloDNA.topCuisines[0]?.pct != null && (
              <p className="font-body text-sm text-[#8A7F78] mt-1">
                {soloDNA.topCuisines[0].pct}% of your decisions
              </p>
            )}

            {/* Cuisine bars — top 3 */}
            {soloTopThree.length > 0 && (
              <div className="mt-5 flex flex-col gap-2.5">
                {soloTopThree.map(({ cuisine, pct }) => {
                  const barW = Math.round((pct / soloMaxPct) * 100);
                  return (
                    <div key={cuisine}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-body text-sm font-semibold text-white">{cuisine}</span>
                        <span className="font-display font-bold text-sm text-[#E8621A]">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "#3D3733" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${barW}%`, background: "linear-gradient(90deg, #E8621A, #c4440e)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Flavor tags */}
            {(activeTags.length > 0 || hardNosList.length > 0) && (
              <div className="mt-5">
                {activeTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeTags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="font-body text-xs font-semibold px-3 py-1.5 rounded-full"
                        style={{ background: "#E8621A20", color: "#E8621A", border: "1px solid #E8621A40" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {hardNosList.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className="font-body text-xs text-[#8A7F78]">Never showing:</span>
                    {hardNosList.map((item) => (
                      <span
                        key={item}
                        className="font-body text-xs px-2.5 py-1 rounded-full line-through"
                        style={{ background: "#3D3733", color: "#8A7F78" }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All-time #1 */}
            {soloDNA.allTimeNumber1 && (
              <div
                className="mt-5 rounded-[14px] px-4 py-4 border"
                style={{ background: "#2A2420", borderColor: "#E8621A30" }}
              >
                <p className="text-[10px] font-semibold tracking-widest uppercase text-[#E8621A] mb-1">
                  ALL-TIME #1
                </p>
                <p className="font-display font-black text-lg text-white leading-tight">
                  {soloDNA.allTimeNumber1.mealName}
                </p>
                {soloDNA.allTimeNumber1.count > 1 && (
                  <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                    Chosen {soloDNA.allTimeNumber1.count}×
                  </p>
                )}
              </div>
            )}

            {/* AI Insights */}
            {soloInsights.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8A7F78] mb-3">
                  WHAT THE DATA SAYS
                </p>
                <div className="flex flex-col gap-3">
                  {soloInsights.slice(0, 2).map((text, i) => (
                    <div key={i} className="border-l-2 border-[#E8621A]/40 pl-3">
                      <p className="font-body text-sm text-white/80 leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share button */}
            <button
              onClick={() => setFlameOverlay("solo")}
              className="mt-6 w-full font-display font-black text-sm py-4 rounded-full bg-[#E8621A] text-white"
            >
              Share my Flavor Card →
            </button>
          </div>
        ) : null}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 3 — Deciding Together (couples DNA, hidden if no partner)
      ────────────────────────────────────────────────────────────────────── */}
      {!dnaLoading && partners.length > 0 && (
        <div className="px-5 mt-10">
          {/* Multi-partner selector — shown only when 2+ partners */}
          {partners.length > 1 && (
            <div
              className="flex overflow-x-auto gap-4 pb-2 mb-5 -mx-5 px-5"
              style={{ scrollbarWidth: "none" }}
            >
              {partners.map((p) => {
                const selected = selectedPartnerId === p.partnerId;
                const firstName = p.displayName
                  ? p.displayName.trim().split(/\s+/)[0]
                  : "Someone";
                return (
                  <button
                    key={p.partnerId}
                    onClick={() => void handlePartnerSelect(p.partnerId)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden transition-all ${
                        selected
                          ? "ring-2 ring-[#E8621A] ring-offset-2 ring-offset-[#1C1A18]"
                          : ""
                      }`}
                      style={{
                        background: "#2A2420",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatarUrl}
                          alt={firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display font-black text-sm text-[#E8621A]">
                          {initials(p.displayName)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-body text-[10px] text-center max-w-[48px] truncate ${
                        selected ? "text-white" : "text-[#8A7F78]"
                      }`}
                    >
                      {firstName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase flex-shrink-0">
              DECIDING TOGETHER
            </p>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Partner header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-[#2A2420] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {partnerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={partnerAvatarUrl}
                  alt={partnerName ?? ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display font-black text-base text-[#E8621A]">
                  {initials(partnerName)}
                </span>
              )}
            </div>
            <div>
              <p className="font-display font-black text-base text-white">
                {partnerName ?? "Someone you matched with"}
              </p>
              <p className="font-body text-xs text-[#8A7F78]">Your dinner partner</p>
            </div>
          </div>

          {/* Data — loading spinner while switching partners */}
          {couplesDNA ? (
            <>
              {/* Shared stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-[#2A2420] rounded-[14px] p-3 flex flex-col items-center justify-center text-center">
                  <span className="font-display font-black text-xl text-[#E8621A]">
                    {couplesDNA.totalMatchesTogether > 0 ? couplesDNA.totalMatchesTogether : "—"}
                  </span>
                  <span className="font-body text-[10px] text-[#8A7F78] mt-0.5 leading-tight">Matches</span>
                </div>
                <div className="bg-[#2A2420] rounded-[14px] p-3 flex flex-col items-center justify-center text-center">
                  <span className="font-display font-black text-xl text-[#E8621A]">
                    {couplesDNA.totalSessionsTogether > 0 ? couplesDNA.totalSessionsTogether : "—"}
                  </span>
                  <span className="font-body text-[10px] text-[#8A7F78] mt-0.5 leading-tight">Sessions</span>
                </div>
                <div className="bg-[#2A2420] rounded-[14px] p-3 flex flex-col items-center justify-center text-center">
                  <span className="font-display font-black text-xl text-[#E8621A]">
                    {couplesDNA.fastestMatchTogether != null
                      ? formatSeconds(couplesDNA.fastestMatchTogether)
                      : "—"}
                  </span>
                  <span className="font-body text-[10px] text-[#8A7F78] mt-0.5 leading-tight">Fastest</span>
                </div>
              </div>

              {/* Couples flavor type — only shown when 7+ matches produced a result */}
              {couplesFlavorType && (
                <div className="mb-5">
                  <p className="font-display font-black text-xl text-white leading-tight">
                    {couplesFlavorType.personalizedName}
                  </p>
                  <p className="font-body text-xs text-[#E8621A] mt-0.5">
                    {getBaseTypeLabel(couplesFlavorType.baseType)}
                  </p>
                  <p className="font-body text-sm text-white/70 mt-1">
                    {couplesFlavorType.tagline}
                  </p>
                </div>
              )}

              {/* Compatibility pairing — only when both users have assigned solo types */}
              {compatibilityPairing && (
                <div className="bg-[#2A2420] rounded-[16px] p-4 mt-4 border-l-4 border-[#E8621A]">
                  <p className="text-[#E8621A] text-[10px] font-semibold tracking-widest uppercase mb-1">
                    YOUR DYNAMIC
                  </p>
                  <p className="font-display font-black text-lg text-white">
                    {compatibilityPairing.name}
                  </p>
                  <p className="font-body text-sm text-[#8A7F78] mt-1">
                    {compatibilityPairing.description}
                  </p>
                </div>
              )}

              {/* Mutual top 2 cuisines */}
              {couplesTopTwo.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8A7F78] mb-3">
                    MUTUAL FAVOURITES
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {couplesTopTwo.map(({ cuisine, pct }) => {
                      const barW = Math.round((pct / couplesMaxPct) * 100);
                      return (
                        <div key={cuisine}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-body text-sm font-semibold text-white">{cuisine}</span>
                            <span className="font-display font-bold text-sm text-[#E8621A]">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "#3D3733" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barW}%`, background: "linear-gradient(90deg, #E8621A, #c4440e)" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Couples AI insights */}
              {couplesInsights.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8A7F78] mb-3">
                    WHAT THE DATA SAYS
                  </p>
                  <div className="flex flex-col gap-3">
                    {couplesInsights.slice(0, 2).map((text, i) => (
                      <div key={i} className="border-l-2 border-[#E8621A]/40 pl-3">
                        <p className="font-body text-sm text-white/80 leading-snug">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* See full couples card */}
              <button
                onClick={() => setFlameOverlay("couples")}
                className="w-full font-display font-black text-sm py-3.5 rounded-full border border-white/20 text-[#8A7F78]"
              >
                See full couples card →
              </button>
            </>
          ) : (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          SECTION 4 — Library (keep as-is)
      ────────────────────────────────────────────────────────────────────── */}

      {/* Dietary restrictions */}
      <div className="px-5 mt-10">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          DIETARY RESTRICTIONS
        </p>
        <div className="flex flex-wrap gap-2">
          {(prefs.dietaryRestrictions ?? []).map((item) => (
            <button
              key={item}
              onClick={() => toggleDietary(item)}
              className="flex items-center gap-1.5 bg-[#2A2420] text-white/80 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
            >
              <span className="font-black">×</span>
              {item}
            </button>
          ))}
          <button
            onClick={() => setShowAddDietary((v) => !v)}
            className="flex items-center gap-1 bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm px-4 py-2 rounded-full"
          >
            + Add
          </button>
        </div>
        {showAddDietary && (
          <div className="flex flex-wrap gap-2 mt-3">
            {DIETARY_OPTIONS.filter(
              (d) => !(prefs.dietaryRestrictions ?? []).includes(d.label)
            ).map((d) => (
              <button
                key={d.label}
                onClick={() => { toggleDietary(d.label); setShowAddDietary(false); }}
                className="flex items-center gap-1.5 bg-[#2A2420] text-white/70 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hard NOs */}
      <div className="px-5 mt-8">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          HARD NOs — NEVER SHOWING THESE
        </p>
        <div className="flex flex-wrap gap-2">
          {prefs.hardNoFoods.map((food) => (
            <button
              key={food}
              onClick={() => toggleDisliked(food)}
              className="flex items-center gap-1.5 bg-red-950/50 text-red-400 font-body font-semibold text-sm px-4 py-2 rounded-full border border-red-900/40"
            >
              <span className="font-black">×</span>
              {food}
            </button>
          ))}
          <button
            onClick={() => setShowAddHardNo((v) => !v)}
            className="flex items-center gap-1 bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm px-4 py-2 rounded-full"
          >
            + Add
          </button>
        </div>
        {showAddHardNo && (
          <div className="flex flex-wrap gap-2 mt-3">
            {DISLIKED_FOODS.filter(
              (f) => f.label !== "None of these" && !prefs.hardNoFoods.includes(f.label)
            ).map((f) => (
              <button
                key={f.label}
                onClick={() => { toggleDisliked(f.label); setShowAddHardNo(false); }}
                className="flex items-center gap-1.5 bg-[#2A2420] text-white/70 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
              >
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
      <BottomNav />

      {/* ──────────────────────────────────────────────────────────────────────
          FlameCard overlay (slides up from bottom, swipe down to close)
      ────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {flameOverlay && (
          <div className="fixed inset-0 z-50 flex flex-col">
            {/* Dark backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setFlameOverlay(null); setShareError(null); }}
            />

            {/* Sheet */}
            <motion.div
              className="relative mt-auto bg-[#1C1A18] rounded-t-[24px] max-h-[90dvh] flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.2 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) {
                  setFlameOverlay(null);
                  setShareError(null);
                }
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1">
                {/* Card */}
                <div className="px-5 pt-3 pb-4">
                  {flameOverlay === "solo" && soloCardProps && (
                    <FlameCard ref={flameCardRef} {...soloCardProps} />
                  )}
                  {flameOverlay === "couples" && couplesCardProps && (
                    <FlameCard ref={flameCardRef} {...couplesCardProps} />
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-8 flex flex-col gap-3">
                  <button
                    onClick={() => { setFlameOverlay(null); setShareError(null); }}
                    className="w-full font-display font-black text-sm py-3 rounded-full border border-white/20 text-[#8A7F78]"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => void handleShare()}
                    disabled={sharing}
                    className="w-full font-display font-black text-sm py-4 rounded-full bg-[#E8621A] text-white disabled:opacity-60"
                  >
                    {sharing ? "Making your card…" : "Share →"}
                  </button>
                  {shareError && (
                    <p className="font-body text-xs text-center text-[#8A7F78]">{shareError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
