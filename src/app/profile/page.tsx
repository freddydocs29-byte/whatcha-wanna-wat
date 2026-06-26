"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import FlameCard from "../components/FlameCard";
import type { FlameCardProps } from "../components/FlameCard";
import CouplesFlavorCard from "../components/CouplesFlavorCard";
import type { CouplesFlavor } from "../lib/couples-flavor-types";
import { baseTypeToCoupleType } from "../lib/couples-flavor-types";
import FlavorTypeCard from "../components/FlavorTypeCard";
import CardRevealOverlay from "../components/CardRevealOverlay";
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
import { getUserId, getAuthUserId, getKnownUserIds, clearAllLocalState, resetAnonymousId } from "../lib/identity";
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
import { trackEvent } from "../lib/analytics";
import { EVENT_PROFILE_VIEWED } from "../lib/analytics-events";

// ── Candlelight film grain ─────────────────────────────────────────────────────

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

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
  { value: 0.2, label: "Keep it familiar",  desc: "Stick to what you know"              },
  { value: 0.5, label: "Mix it up",         desc: "Some variety, some comfort"          },
  { value: 0.8, label: "Surprise me",       desc: "Discover something new every time"   },
];

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

  // ── Change email state ─────────────────────────────────────────────────────
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
  const [totalSharedDecisions, setTotalSharedDecisions] = useState<number>(0);
  const [couplesFlavorType, setCouplesFlavorType] = useState<FlavorTypeResult | null>(null);
  const [couplesInsights, setCouplesInsights] = useState<string[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerInfo[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerSoloBaseType, setPartnerSoloBaseType] = useState<BaseFlavorType | null>(null);

  // ── Tracks whether flavorType was pre-populated from localStorage ─────────
  const flavorTypePreloadedRef = useRef(false);

  // ── FlameCard overlay (couples only) ──────────────────────────────────────
  const [flameOverlay, setFlameOverlay] = useState<"couples" | null>(null);
  // ── CouplesFlavorCard overlay ─────────────────────────────────────────────
  const [showProfileCouplesCard, setShowProfileCouplesCard] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const flameCardRef = useRef<HTMLDivElement>(null);

  // ── FlavorTypeCard reveal (solo) ───────────────────────────────────────────
  const [revealOpen, setRevealOpen] = useState(false);
  const flavorCardRef = useRef<HTMLDivElement>(null);
  // Hidden off-screen export surface (1080×1920) captured by html2canvas
  const exportCardRef = useRef<HTMLDivElement>(null);

  // ── Saved toast ────────────────────────────────────────────────────────────
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dietary / Hard NOs add mode ───────────────────────────────────────────
  const [showAddDietary, setShowAddDietary] = useState(false);
  const [showAddHardNo, setShowAddHardNo] = useState(false);

  const profileViewedRef = useRef(false);
  useEffect(() => {
    if (profileViewedRef.current) return;
    profileViewedRef.current = true;
    trackEvent(EVENT_PROFILE_VIEWED, {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Sync reads — all available immediately from localStorage.
    setPrefs(getPreferences() ?? {
      cuisines: [],
      dietaryRestrictions: [],
      hardNoFoods: [],
      allergens: [],
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
        if (authUid) {
          supabase.auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email ?? null);
          });
        }
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
        // Use all known IDs (localStorage UUID + auth UUID when signed in) so
        // rows written under either identity are found. localStorage UUID is
        // always first — it is the canonical write identity.
        const knownIds = await getKnownUserIds();
        const primaryId = getUserId(); // always localStorage UUID
        const allUserIds = knownIds.join(",");
        const [fetchRes, selfProfile] = await Promise.all([
          fetch(`/api/profile/dna?userId=${encodeURIComponent(primaryId)}&allUserIds=${encodeURIComponent(allUserIds)}`),
          fetchOrCreateProfile(primaryId),
        ]);

        if (!fetchRes.ok) throw new Error(`DNA API ${fetchRes.status}`);

        const data = (await fetchRes.json()) as {
          solo: SoloDNA | null;
          couples: CouplesDNA | null;
          soloInsights: null;
          couplesInsights: null;
          partners: PartnerInfo[] | null;
          totalSharedDecisions?: number;
        };

        const allPartners = data.partners ?? [];
        setSoloDNA(data.solo);
        setPartners(allPartners);
        setTotalSharedDecisions(data.totalSharedDecisions ?? 0);

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
          getFlavorType(data.solo, "solo", selfProfile?.display_name ?? undefined, primaryId)
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
                      .eq("user_id", primaryId)
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

          // The initial fetch has no partnerId so data.couples is always null.
          // Make a second call with the first partner's ID to get couplesDNA.
          try {
            const couplesRes = await fetch(
              `/api/profile/dna?userId=${encodeURIComponent(primaryId)}&allUserIds=${encodeURIComponent(allUserIds)}&partnerId=${encodeURIComponent(firstPartner.partnerId)}`
            );
            if (couplesRes.ok) {
              const couplesData = (await couplesRes.json()) as { couples: CouplesDNA | null };
              if (couplesData.couples) {
                setCouplesDNA(couplesData.couples);
                const ci = await getCouplesInsights(
                  couplesData.couples,
                  selfProfile?.display_name ?? undefined,
                  firstPartner.displayName ?? undefined,
                  primaryId,
                  firstPartner.partnerId
                ).catch(() => []);
                setCouplesInsights(ci);

                // Couples flavor type — only when 7+ shared accepted matches
                if (couplesData.couples.totalMatchesTogether >= 7) {
                  getFlavorType(
                    couplesData.couples,
                    { partnerId: firstPartner.partnerId },
                    selfProfile?.display_name ?? undefined,
                    primaryId
                  )
                    .then(setCouplesFlavorType)
                    .catch(() => { /* non-fatal */ });
                }
              }
            }
          } catch { /* non-fatal */ }
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

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus("sending");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailStatus("error");
    } else {
      setEmailStatus("sent");
    }
  }

  // ── Share handler (html2canvas) ────────────────────────────────────────────

  async function handleShare() {
    if (!flameCardRef.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(flameCardRef.current, {
        backgroundColor: "#0F0A07",
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

  // ── FlavorTypeCard share / save ───────────────────────────────────────────

  async function handleFlavorShare() {
    const target = exportCardRef.current ?? flavorCardRef.current;
    if (!target) return;
    const isExport = !!exportCardRef.current;
    setSharing(true);
    setShareError(null);
    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: isExport ? 1080 / 390 : 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: target.offsetWidth,
        height: target.offsetHeight,
        windowWidth: target.offsetWidth,
        windowHeight: target.offsetHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) { setShareError("Couldn't share. Try saving the image."); setSharing(false); return; }
        const file = new File([blob], "watcha-flavor-card.png", { type: "image/png" });
        if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "My Watcha? Flavor Card" });
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              setShareError("Couldn't share. Try saving the image.");
            }
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "watcha-flavor-card.png";
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

  async function handleFlavorSave() {
    const target = exportCardRef.current ?? flavorCardRef.current;
    if (!target) return;
    const isExport = !!exportCardRef.current;
    setSharing(true);
    setShareError(null);
    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: isExport ? 1080 / 390 : 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: target.offsetWidth,
        height: target.offsetHeight,
        windowWidth: target.offsetWidth,
        windowHeight: target.offsetHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      canvas.toBlob((blob) => {
        if (!blob) { setSharing(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "watcha-flavor-card.png";
        a.click();
        URL.revokeObjectURL(url);
        setSharing(false);
      }, "image/png");
    } catch {
      setShareError("Couldn't save. Try again.");
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
      const knownIds = await getKnownUserIds();
      const allUserIds = knownIds.join(",");
      const res = await fetch(
        `/api/profile/dna?userId=${encodeURIComponent(uid)}&allUserIds=${encodeURIComponent(allUserIds)}&partnerId=${encodeURIComponent(partnerId)}`
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

  if (!prefs) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B0805" }}>
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
      </div>
    );
  }

  const avatarInitials = initials(displayName || null);

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white pb-24"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.16) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 40% at 50% 104%, rgba(184,74,18,0.16) 0%, transparent 66%)," +
            "radial-gradient(ellipse 40% 22% at 84% 30%, rgba(230,178,106,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Film grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: GRAIN_SVG }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }}
      />

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="relative z-[2]">

        {/* ── Saved toast ──────────────────────────────────────────────────────── */}
        <span
          className={`fixed top-4 right-4 z-50 rounded-full px-3 py-1 font-body text-xs transition-all duration-300 ${
            savedVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            background: "rgba(255,231,202,0.07)",
            border: "1px solid rgba(245,237,224,0.12)",
            color: "rgba(245,237,224,0.55)",
          }}
        >
          Saved
        </span>

        {/* ──────────────────────────────────────────────────────────────────────
            SECTION 1 — Identity
        ────────────────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-2">
          {/* Avatar top right */}
          <div className="flex items-center justify-end mb-6">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => authUserId && avatarInputRef.current?.click()}
                  className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-display font-black text-lg text-white ${
                    avatarUrl ? "" : ""
                  } ${authUserId ? "cursor-pointer" : "cursor-default"}`}
                  style={{ background: avatarUrl ? undefined : "#E8621A" }}
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
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center pointer-events-none"
                    style={{ background: "#E8621A" }}
                  >
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
              <h1
                className="text-white"
                style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "32px", letterSpacing: "-0.02em" }}
              >
                Profile
              </h1>
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
                  <p className="font-body text-[13.5px]" style={{ color: "#897E73", fontWeight: 300 }}>
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
              className="font-body font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 ml-4 transition hover:opacity-80"
              style={{
                background: "rgba(255,231,202,0.07)",
                border: "1px solid rgba(245,237,224,0.1)",
                color: "rgba(245,237,224,0.7)",
              }}
            >
              Edit
            </Link>
          </div>
        </div>

        {/* ── 1b. Auth CTA ──────────────────────────────────────────────────────── */}
        {!asyncLoading && (
          <div className="mx-5 mt-4">
            {authUserId ? (
              <div className="flex flex-col gap-2">
                {/* Connected row */}
                <div
                  className="flex items-center justify-between rounded-[14px] px-4 py-3"
                  style={{
                    background: "rgba(255,231,202,0.05)",
                    border: "1px solid rgba(245,237,224,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#E8621A] text-sm">✓</span>
                    <p className="font-body text-sm" style={{ color: "rgba(245,237,224,0.7)" }}>Account connected</p>
                  </div>
                  <button
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="font-body text-xs disabled:opacity-50"
                    style={{ color: "#897E73" }}
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>

                {/* Account section — email */}
                <div
                  className="rounded-[14px] px-4 py-3"
                  style={{
                    background: "rgba(255,231,202,0.03)",
                    border: "1px solid rgba(245,237,224,0.07)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="font-body text-[10px] uppercase tracking-widest mb-0.5"
                        style={{ color: "#897E73", letterSpacing: "0.18em" }}
                      >
                        Email
                      </p>
                      <p className="font-body text-sm" style={{ color: "rgba(245,237,224,0.65)" }}>
                        {userEmail ?? "—"}
                      </p>
                    </div>
                    {!showEmailForm && emailStatus !== "sent" && (
                      <button
                        onClick={() => { setShowEmailForm(true); setEmailStatus("idle"); setNewEmail(""); }}
                        className="font-body text-xs"
                        style={{ color: "#897E73" }}
                      >
                        Change email
                      </button>
                    )}
                  </div>

                  {showEmailForm && emailStatus !== "sent" && (
                    <form onSubmit={(e) => void handleChangeEmail(e)} className="mt-3 flex flex-col gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="New email address"
                        required
                        autoComplete="email"
                        className="w-full rounded-[10px] px-3 py-2.5 font-body text-sm text-white placeholder:text-[#897E73]/60 focus:outline-none"
                        style={{
                          background: "rgba(255,231,202,0.045)",
                          border: "1px solid rgba(245,237,224,0.12)",
                        }}
                      />
                      {emailStatus === "error" && (
                        <p className="font-body text-xs text-red-400">Something went wrong. Please try again.</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={emailStatus === "sending"}
                          className="flex-1 rounded-full py-2.5 font-body text-sm font-semibold disabled:opacity-50 transition-opacity"
                          style={{
                            background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                            color: "#1c0c03",
                            fontFamily: "var(--font-quicksand)",
                            fontWeight: 700,
                          }}
                        >
                          {emailStatus === "sending" ? "Sending…" : "Update email"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowEmailForm(false); setEmailStatus("idle"); }}
                          className="px-4 rounded-full font-body text-sm"
                          style={{ color: "#897E73" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {emailStatus === "sent" && (
                    <div className="mt-3">
                      <p className="font-body text-sm" style={{ color: "#E8621A" }}>
                        Check your inbox to confirm the email change.
                      </p>
                      <p className="font-body text-xs mt-1" style={{ color: "rgba(137,126,115,0.7)" }}>
                        You may need to confirm from both your old and new email addresses.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth")}
                className="w-full flex items-center justify-between rounded-[14px] px-4 py-3.5 transition hover:opacity-90"
                style={{
                  background: "rgba(255,231,202,0.055)",
                  border: "1px solid rgba(245,237,224,0.09)",
                  boxShadow: "inset 0 1px 0 rgba(245,237,224,0.05)",
                }}
              >
                <div>
                  <p className="text-white text-left" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "14px" }}>Create an account</p>
                  <p className="font-body text-xs mt-0.5 text-left" style={{ color: "#897E73", fontWeight: 300 }}>Sync your profile across devices</p>
                </div>
                <span className="text-[#E8621A] text-lg flex-shrink-0">→</span>
              </button>
            )}
          </div>
        )}

        {/* ── Stats row ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5 mx-5 mt-6">
          {[
            { value: history.length, label: "Decisions" },
            { value: mealsTriedCount, label: "Meals tried" },
            { value: totalSharedDecisions, label: "With others" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-[16px] py-4 px-3 flex flex-col items-center justify-center text-center"
              style={{
                background: "rgba(255,231,202,0.045)",
                border: "1px solid rgba(245,237,224,0.085)",
                boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
                backdropFilter: "blur(20px)",
              }}
            >
              <span
                className="text-[#E8621A] leading-none"
                style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "30px" }}
              >
                {value}
              </span>
              <span className="font-body text-[11.5px] text-center mt-1.5" style={{ color: "rgba(199,189,172,0.8)", fontWeight: 400 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ──────────────────────────────────────────────────────────────────────
            SECTION 2 — Your Flame (solo DNA)
        ────────────────────────────────────────────────────────────────────── */}
        <div
          className="mx-5 mt-10 rounded-[20px] overflow-hidden"
          style={{
            background: "rgba(255,231,202,0.04)",
            border: "1px solid rgba(245,237,224,0.09)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,237,224,0.06)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Ember top hairline */}
          <div
            className="h-[3px] w-full"
            style={{
              background: "linear-gradient(90deg, #FF8A3D 0%, #E8621A 55%, rgba(232,98,26,0.1) 100%)",
              boxShadow: "0 0 12px rgba(232,98,26,0.5)",
            }}
          />
          <div className="px-5 pt-5 pb-6">
            <p
              className="text-[10px] tracking-[2.4px] uppercase mb-5"
              style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Your flame
            </p>

            {dnaLoading ? (
              /* Skeleton */
              <div>
                <div className="h-7 w-52 rounded-full animate-pulse mb-2" style={{ background: "rgba(255,231,202,0.06)" }} />
                <div className="h-4 w-36 rounded-full animate-pulse mb-6" style={{ background: "rgba(255,231,202,0.04)" }} />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 mb-3">
                    <div className="h-3 w-16 rounded-full animate-pulse flex-shrink-0" style={{ background: "rgba(255,231,202,0.04)" }} />
                    <div className="flex-1 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(255,231,202,0.04)" }} />
                    <div className="h-3 w-8 rounded-full animate-pulse flex-shrink-0" style={{ background: "rgba(255,231,202,0.04)" }} />
                  </div>
                ))}
              </div>
            ) : soloDNA && soloDNA.totalDecisions < 3 ? (
              /* Not enough data */
              <div className="flex flex-col items-center text-center py-6">
                <p className="text-white leading-snug mb-2" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "24px" }}>
                  Your Flame is still warming up.
                </p>
                <p className="font-body text-[13.5px] leading-relaxed mb-6" style={{ color: "#897E73", fontWeight: 300 }}>
                  Make a few more dinner decisions and we&apos;ll have something real to say.
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="text-sm px-6 py-3.5 rounded-full text-white transition hover:opacity-95 active:scale-[0.99]"
                  style={{
                    fontFamily: "var(--font-quicksand)",
                    fontWeight: 700,
                    background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                    boxShadow: "0 0 24px rgba(232,98,26,0.35)",
                  }}
                >
                  Go decide →
                </button>
              </div>
            ) : soloDNA ? (
              /* Full flame content */
              <div>
                {/* Flavor type block */}
                {flavorType ? (
                  <div className="mb-5">
                    <p
                      className="text-white leading-tight"
                      style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "26px", letterSpacing: "-0.01em" }}
                    >
                      {flavorType.personalizedName}
                    </p>
                    <p className="font-body text-[13px] font-medium mt-1" style={{ color: "#E8621A" }}>
                      {getBaseTypeLabel(flavorType.baseType)}
                    </p>
                    <p className="font-body text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(199,189,172,0.85)", fontWeight: 300 }}>
                      {flavorType.tagline}
                    </p>
                  </div>
                ) : soloDNA.totalDecisions < 7 ? (
                  <div className="mb-5">
                    <p className="font-body text-sm" style={{ color: "#897E73" }}>Still learning you…</p>
                    <p className="font-body text-xs mt-0.5" style={{ color: "rgba(138,127,120,0.6)" }}>
                      {7 - soloDNA.totalDecisions}{" "}
                      {7 - soloDNA.totalDecisions === 1 ? "more decision" : "more decisions"} until your type is revealed
                    </p>
                  </div>
                ) : null}

                {/* Hero cuisine headline */}
                <div className="mb-0.5">
                  <p
                    className="text-[10px] tracking-[2.4px] uppercase"
                    style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {soloDNA.topCuisines[0]?.cuisine ?? "Your taste"} runs the table
                  </p>
                </div>
                <p
                  className="text-white leading-tight"
                  style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "28px", letterSpacing: "-0.01em" }}
                >
                  {soloDNA.topCuisines[0]?.pct != null ? `${soloDNA.topCuisines[0].pct}% of your decisions` : "Your taste"}
                </p>

                {/* Cuisine bars — top 3 */}
                {soloTopThree.length > 0 && (
                  <div className="mt-5 flex flex-col gap-2.5">
                    {soloTopThree.map(({ cuisine, pct }) => {
                      const barW = Math.round((pct / soloMaxPct) * 100);
                      return (
                        <div key={cuisine}>
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="font-body text-sm font-medium text-white">{cuisine}</span>
                            <span className="font-body text-sm font-semibold" style={{ color: "#E8621A" }}>{pct}%</span>
                          </div>
                          <div
                            className="h-[5px] w-full rounded-full overflow-hidden"
                            style={{ background: "rgba(255,231,202,0.08)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${barW}%`,
                                background: "linear-gradient(90deg, #FF8A3D, #E8621A)",
                                boxShadow: "0 0 8px rgba(232,98,26,0.5)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Flavor tags + hard NOs */}
                {(activeTags.length > 0 || hardNosList.length > 0) && (
                  <div className="mt-5">
                    {activeTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {activeTags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="font-body text-[12.5px] font-medium px-3 py-1.5 rounded-full"
                            style={{
                              background: "rgba(232,98,26,0.04)",
                              border: "1px solid rgba(232,98,26,0.26)",
                              color: "rgba(232,98,26,0.9)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {hardNosList.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="font-body text-[13px]" style={{ color: "#897E73" }}>Never showing:</span>
                        {hardNosList.map((item) => (
                          <span
                            key={item}
                            className="font-body text-[12.5px] px-3 py-1.5 rounded-full line-through"
                            style={{
                              background: "rgba(255,231,202,0.08)",
                              color: "#897E73",
                            }}
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
                    className="mt-5 rounded-[18px] px-4 py-4"
                    style={{
                      background: "rgba(232,98,26,0.04)",
                      border: "1px solid rgba(232,98,26,0.26)",
                    }}
                  >
                    <p
                      className="text-[10px] tracking-[2px] uppercase mb-2"
                      style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      All-time #1
                    </p>
                    <p
                      className="text-white leading-tight"
                      style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "22px" }}
                    >
                      {soloDNA.allTimeNumber1.mealName}
                    </p>
                    {soloDNA.allTimeNumber1.count > 1 && (
                      <p className="font-body text-[12.5px] mt-1" style={{ color: "#897E73", fontWeight: 300 }}>
                        Chosen {soloDNA.allTimeNumber1.count}×
                      </p>
                    )}
                  </div>
                )}

                {/* AI Insights */}
                {soloInsights.length > 0 && (
                  <div className="mt-5">
                    <p
                      className="text-[10px] tracking-[2.4px] uppercase mb-3"
                      style={{ color: "rgba(245,237,224,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      What the data says
                    </p>
                    <div className="flex flex-col gap-3">
                      {soloInsights.slice(0, 2).map((text, i) => (
                        <div
                          key={i}
                          className="pl-3"
                          style={{ borderLeft: "2px solid rgba(232,98,26,0.4)" }}
                        >
                          <p className="font-body text-[13px] leading-snug" style={{ color: "rgba(199,189,172,0.85)", fontWeight: 300 }}>{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share CTA — gradient */}
                <button
                  onClick={() => { setRevealOpen(true); setShareError(null); }}
                  className="mt-6 w-full text-sm py-4 rounded-full text-white transition hover:opacity-95 active:scale-[0.99]"
                  style={{
                    fontFamily: "var(--font-quicksand)",
                    fontWeight: 700,
                    background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                    boxShadow: "0 0 24px rgba(232,98,26,0.35)",
                  }}
                >
                  Share my Flavor Card →
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────────
            SECTION 3 — Deciding Together
        ────────────────────────────────────────────────────────────────────── */}

        {/* Empty state — no partners */}
        {!dnaLoading && partners.length === 0 && (
          <div
            className="mx-5 mt-6 rounded-[20px] overflow-hidden"
            style={{
              background: "rgba(255,231,202,0.035)",
              border: "1px solid rgba(245,237,224,0.07)",
              boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
            }}
          >
            <div
              className="h-[3px] w-full"
              style={{ background: "linear-gradient(90deg, rgba(232,98,26,0.5), transparent)" }}
            />
            <div className="px-5 py-8 flex flex-col items-center text-center">
              <p
                className="text-[11px] tracking-[2.4px] uppercase mb-4"
                style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Deciding together
              </p>
              <p className="text-white leading-tight mb-2" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "22px" }}>
                Dinner&apos;s better shared.
              </p>
              <p className="font-body text-[13.5px] leading-relaxed mb-6" style={{ color: "#897E73", fontWeight: 300 }}>
                Invite someone to swipe with you and we&apos;ll start building your shared flavor DNA.
              </p>
              <Link
                href="/"
                className="rounded-full px-6 py-3.5 text-sm text-white transition hover:opacity-95 active:scale-[0.99]"
                style={{
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                  background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                  boxShadow: "0 0 24px rgba(232,98,26,0.35)",
                }}
              >
                Start a shared session →
              </Link>
            </div>
          </div>
        )}

        {/* Active partner section */}
        {!dnaLoading && partners.length > 0 && (
          <div
            className="mx-5 mt-6 rounded-[20px] overflow-hidden"
            style={{
              background: "rgba(255,231,202,0.04)",
              border: "1px solid rgba(245,237,224,0.09)",
              boxShadow: "0 4px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,237,224,0.06)",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Ember top hairline */}
            <div
              className="h-[3px] w-full"
              style={{
                background: "linear-gradient(90deg, #FF8A3D 0%, #E8621A 55%, rgba(232,98,26,0.1) 100%)",
                boxShadow: "0 0 12px rgba(232,98,26,0.5)",
              }}
            />
            <div className="px-5 pt-5 pb-6">
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
                              ? "ring-2 ring-[#E8621A] ring-offset-2 ring-offset-[#0B0805]"
                              : ""
                          }`}
                          style={{
                            background: "rgba(255,231,202,0.07)",
                            border: "1px solid rgba(245,237,224,0.1)",
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
                <div className="flex-1 h-px" style={{ background: "rgba(245,237,224,0.085)" }} />
                <p
                  className="text-[10px] tracking-[3px] uppercase flex-shrink-0"
                  style={{ color: "#897E73", fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Deciding together
                </p>
                <div className="flex-1 h-px" style={{ background: "rgba(245,237,224,0.085)" }} />
              </div>

              {/* Partner header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    background: "rgba(255,231,202,0.07)",
                    border: "1px solid rgba(245,237,224,0.1)",
                  }}
                >
                  {partnerAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={partnerAvatarUrl}
                      alt={partnerName ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#E8621A]" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "16px" }}>
                      {initials(partnerName)}
                    </span>
                  )}
                </div>
                <div>
                  <p
                    className="text-white"
                    style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "19px" }}
                  >
                    {partnerName ?? "Someone you matched with"}
                  </p>
                  <p className="font-body text-[13px] mt-0.5" style={{ color: "#897E73", fontWeight: 300 }}>Your dinner partner</p>
                </div>
              </div>

              {/* Data — loading spinner while switching partners */}
              {couplesDNA ? (
                <>
                  {/* Shared stats row */}
                  <div className="grid grid-cols-3 gap-2.5 mb-5">
                    {[
                      { value: couplesDNA.totalMatchesTogether > 0 ? couplesDNA.totalMatchesTogether : "—", label: "Matches" },
                      { value: couplesDNA.totalSessionsTogether > 0 ? couplesDNA.totalSessionsTogether : "—", label: "Sessions" },
                      { value: couplesDNA.fastestMatchTogether != null ? formatSeconds(couplesDNA.fastestMatchTogether) : "—", label: "Fastest" },
                    ].map(({ value, label }) => (
                      <div
                        key={label}
                        className="rounded-[14px] p-3 flex flex-col items-center justify-center text-center"
                        style={{
                          background: "rgba(255,231,202,0.045)",
                          border: "1px solid rgba(245,237,224,0.085)",
                          boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
                        }}
                      >
                        <span
                          className="text-[#E8621A] leading-none"
                          style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "22px" }}
                        >
                          {value}
                        </span>
                        <span className="font-body text-[10px] mt-1 leading-tight" style={{ color: "#897E73", fontWeight: 400 }}>{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Couples flavor type */}
                  {couplesFlavorType && (
                    <div className="mb-5">
                      <p
                        className="text-white leading-tight"
                        style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.01em" }}
                      >
                        {couplesFlavorType.personalizedName}
                      </p>
                      <p className="font-body text-[13px] font-medium mt-1" style={{ color: "#E8621A" }}>
                        {getBaseTypeLabel(couplesFlavorType.baseType)}
                      </p>
                      <p className="font-body text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(199,189,172,0.85)", fontWeight: 300 }}>
                        {couplesFlavorType.tagline}
                      </p>
                    </div>
                  )}

                  {/* Compatibility pairing */}
                  {compatibilityPairing && (
                    <div
                      className="rounded-[18px] p-4 mt-4"
                      style={{
                        background: "rgba(255,231,202,0.045)",
                        border: "1px solid rgba(245,237,224,0.085)",
                        borderLeft: "3px solid #E8621A",
                        boxShadow: "0 0 26px rgba(232,98,26,0.06), inset 0 1px 0 rgba(245,237,224,0.04)",
                      }}
                    >
                      <p
                        className="text-[10px] tracking-[2.4px] uppercase mb-2"
                        style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        Your dynamic
                      </p>
                      <p
                        className="text-white"
                        style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "24px", letterSpacing: "-0.01em" }}
                      >
                        {compatibilityPairing.name}
                      </p>
                      <p className="font-body text-[13.5px] mt-2 leading-relaxed" style={{ color: "#897E73", fontWeight: 300 }}>
                        {compatibilityPairing.description}
                      </p>
                    </div>
                  )}

                  {/* Mutual top cuisines */}
                  {couplesTopTwo.length > 0 && (
                    <div className="mb-5 mt-5">
                      <p
                        className="text-[10px] tracking-[2.4px] uppercase mb-3"
                        style={{ color: "#897E73", fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        Mutual favourites
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {couplesTopTwo.map(({ cuisine, pct }) => {
                          const barW = Math.round((pct / couplesMaxPct) * 100);
                          return (
                            <div key={cuisine}>
                              <div className="flex items-baseline justify-between mb-2">
                                <span className="font-body text-sm font-medium text-white">{cuisine}</span>
                                <span className="font-body text-sm font-semibold" style={{ color: "#E8621A" }}>{pct}%</span>
                              </div>
                              <div
                                className="h-[5px] w-full rounded-full overflow-hidden"
                                style={{ background: "rgba(255,231,202,0.08)" }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${barW}%`,
                                    background: "linear-gradient(90deg, #FF8A3D, #E8621A)",
                                    boxShadow: "0 0 8px rgba(232,98,26,0.5)",
                                  }}
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
                      <p
                        className="text-[10px] tracking-[2.4px] uppercase mb-3"
                        style={{ color: "rgba(245,237,224,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        What the data says
                      </p>
                      <div className="flex flex-col gap-3">
                        {couplesInsights.slice(0, 2).map((text, i) => (
                          <div
                            key={i}
                            className="pl-3"
                            style={{ borderLeft: "2px solid rgba(232,98,26,0.4)" }}
                          >
                            <p className="font-body text-[13px] leading-snug" style={{ color: "rgba(199,189,172,0.85)", fontWeight: 300 }}>{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* See full couples card — only shown when type data is ready */}
                  {couplesFlavorType && couplesDNA && couplesDNA.totalMatchesTogether >= 7 && (
                    <button
                      onClick={() => setShowProfileCouplesCard(true)}
                      className="w-full text-sm py-3.5 rounded-full transition hover:opacity-80"
                      style={{
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        background: "rgba(255,231,202,0.05)",
                        border: "1px solid rgba(245,237,224,0.12)",
                        color: "rgba(245,237,224,0.6)",
                      }}
                    >
                      See our flavor card →
                    </button>
                  )}
                </>
              ) : (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────────
            SECTION 4 — Library
        ────────────────────────────────────────────────────────────────────── */}

        {/* Dietary restrictions */}
        <div
          className="mx-5 mt-6 rounded-[20px] px-5 py-5"
          style={{
            background: "rgba(255,231,202,0.04)",
            border: "1px solid rgba(245,237,224,0.08)",
            boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
          }}
        >
          <p
            className="text-[11px] tracking-[2.4px] uppercase mb-3"
            style={{ color: "rgba(245,237,224,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Dietary restrictions
          </p>
          <div className="flex flex-wrap gap-2">
            {(prefs.dietaryRestrictions ?? []).map((item) => (
              <button
                key={item}
                onClick={() => toggleDietary(item)}
                className="flex items-center gap-1.5 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
                style={{
                  background: "rgba(255,231,202,0.07)",
                  border: "1px solid rgba(245,237,224,0.12)",
                  color: "rgba(245,237,224,0.8)",
                }}
              >
                <span className="font-black">×</span>
                {item}
              </button>
            ))}
            <button
              onClick={() => setShowAddDietary((v) => !v)}
              className="flex items-center gap-1 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
              style={{
                background: "rgba(255,231,202,0.04)",
                border: "1px solid rgba(245,237,224,0.07)",
                color: "#897E73",
              }}
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
                  className="flex items-center gap-1.5 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
                  style={{
                    background: "rgba(255,231,202,0.07)",
                    border: "1px solid rgba(245,237,224,0.1)",
                    color: "rgba(245,237,224,0.7)",
                  }}
                >
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hard NOs */}
        <div
          className="mx-5 mt-6 mb-4 rounded-[20px] px-5 py-5"
          style={{
            background: "rgba(255,231,202,0.04)",
            border: "1px solid rgba(245,237,224,0.08)",
            boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
          }}
        >
          <p
            className="text-[11px] tracking-[2.4px] uppercase mb-3"
            style={{ color: "rgba(245,237,224,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Hard NOs — never showing these
          </p>
          <div className="flex flex-wrap gap-2">
            {prefs.hardNoFoods.map((food) => (
              <button
                key={food}
                onClick={() => toggleDisliked(food)}
                className="flex items-center gap-1.5 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "rgba(252,165,165,0.9)",
                }}
              >
                <span className="font-black">×</span>
                {food}
              </button>
            ))}
            <button
              onClick={() => setShowAddHardNo((v) => !v)}
              className="flex items-center gap-1 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
              style={{
                background: "rgba(255,231,202,0.04)",
                border: "1px solid rgba(245,237,224,0.07)",
                color: "#897E73",
              }}
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
                  className="flex items-center gap-1.5 font-body font-semibold text-sm px-4 py-2 rounded-full transition hover:opacity-80"
                  style={{
                    background: "rgba(255,231,202,0.07)",
                    border: "1px solid rgba(245,237,224,0.1)",
                    color: "rgba(245,237,224,0.7)",
                  }}
                >
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit food preferences CTA */}
        <div className="mx-5 mt-4 mb-2">
          <button
            onClick={() => router.push("/onboarding?edit=true")}
            className="w-full flex items-center justify-between rounded-[14px] px-4 py-3.5 transition hover:opacity-90"
            style={{
              background: "rgba(255,231,202,0.055)",
              border: "1px solid rgba(245,237,224,0.09)",
              boxShadow: "inset 0 1px 0 rgba(245,237,224,0.05)",
            }}
          >
            <div>
              <p className="text-white text-left" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "14px" }}>Edit food preferences</p>
              <p className="font-body text-xs mt-0.5 text-left" style={{ color: "#897E73", fontWeight: 300 }}>Update cuisines, dietary needs, and hard NOs.</p>
            </div>
            <span className="text-[#E8621A] text-lg flex-shrink-0">→</span>
          </button>
        </div>

        {/* Novelty bias */}
        <div
          className="mx-5 mt-6 mb-4 rounded-[20px] px-5 py-5"
          style={{
            background: "rgba(255,231,202,0.04)",
            border: "1px solid rgba(245,237,224,0.08)",
            boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
          }}
        >
          <p
            className="text-[11px] tracking-[2.4px] uppercase mb-1"
            style={{ color: "rgba(245,237,224,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Deck vibe
          </p>
          <p className="font-body text-xs mb-4" style={{ color: "rgba(199,189,172,0.55)" }}>
            Controls how familiar or adventurous your deck feels.
          </p>
          <div className="flex flex-col gap-2">
            {NOVELTY_OPTIONS.map((opt) => {
              const active = noveltyBias === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => selectNoveltyBias(opt.value)}
                  className="flex items-center justify-between px-4 py-3 rounded-[14px] text-left transition hover:opacity-90"
                  style={{
                    background: active ? "rgba(232,98,26,0.15)" : "rgba(255,231,202,0.04)",
                    border: active ? "1px solid rgba(232,98,26,0.4)" : "1px solid rgba(245,237,224,0.07)",
                  }}
                >
                  <div>
                    <p
                      className="font-body font-semibold text-sm"
                      style={{ color: active ? "#E8621A" : "rgba(245,237,224,0.8)" }}
                    >
                      {opt.label}
                    </p>
                    <p className="font-body text-xs mt-0.5" style={{ color: "rgba(199,189,172,0.5)" }}>
                      {opt.desc}
                    </p>
                  </div>
                  {active && (
                    <span style={{ color: "#E8621A", fontSize: "16px" }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
        <BottomNav />

      </div>{/* end z-[2] content */}

      {/* ──────────────────────────────────────────────────────────────────────
          FlameCard overlay — couples only (slides up from bottom)
      ────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {flameOverlay === "couples" && (
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
              className="relative mt-auto rounded-t-[24px] max-h-[90dvh] flex flex-col"
              style={{ background: "#0B0805" }}
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
                  {couplesCardProps && (
                    <FlameCard ref={flameCardRef} {...couplesCardProps} />
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-8 flex flex-col gap-3">
                  <button
                    onClick={() => { setFlameOverlay(null); setShareError(null); }}
                    className="w-full text-sm py-3 rounded-full transition hover:opacity-80"
                    style={{
                      fontFamily: "var(--font-quicksand)",
                      fontWeight: 700,
                      background: "rgba(255,231,202,0.05)",
                      border: "1px solid rgba(245,237,224,0.12)",
                      color: "rgba(245,237,224,0.6)",
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => void handleShare()}
                    disabled={sharing}
                    className="w-full text-sm py-4 rounded-full text-white disabled:opacity-60 transition hover:opacity-95"
                    style={{
                      fontFamily: "var(--font-quicksand)",
                      fontWeight: 700,
                      background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                      boxShadow: "0 0 24px rgba(232,98,26,0.35)",
                    }}
                  >
                    {sharing ? "Making your card…" : "Share →"}
                  </button>
                  {shareError && (
                    <p className="font-body text-xs text-center" style={{ color: "#897E73" }}>{shareError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────────
          FlavorTypeCard reveal overlay — solo (full-screen animated reveal)
      ────────────────────────────────────────────────────────────────────── */}
      {soloDNA && flavorType && (
        <CardRevealOverlay
          open={revealOpen}
          onClose={() => { setRevealOpen(false); setShareError(null); setSharing(false); }}
          onShare={() => void handleFlavorShare()}
          onSave={() => void handleFlavorSave()}
          sharing={sharing}
          shareError={shareError}
        >
          <FlavorTypeCard
            ref={flavorCardRef}
            flavorType={flavorType}
            userName={displayName || undefined}
            soloDNA={soloDNA}
            hardNos={hardNosList.length ? hardNosList : undefined}
          />
        </CardRevealOverlay>
      )}

      {/* ── Couples Flavor Card overlay ───────────────────────────────────── */}
      {showProfileCouplesCard && couplesFlavorType && couplesDNA && (
        <CouplesFlavorCard
          flavor={(() => {
            const avgSec = couplesDNA.avgMatchTimeTogether;
            let avgMatchTime = "—";
            if (avgSec !== null && avgSec > 0) {
              if (avgSec < 60) avgMatchTime = `${Math.round(avgSec)} sec`;
              else if (avgSec < 300) avgMatchTime = `${Math.round(avgSec / 60)} min flat`;
              else avgMatchTime = `${Math.round(avgSec / 60)} min`;
            }
            return {
              type: baseTypeToCoupleType(couplesFlavorType.baseType) ?? "wildcard",
              people: [
                { name: displayName || "You", avatarUrl: avatarUrl ?? "" },
                { name: partnerName ?? "Partner", avatarUrl: partnerAvatarUrl ?? "" },
              ] as [{ name: string; avatarUrl: string }, { name: string; avatarUrl: string }],
              totalMatches: couplesDNA.totalMatchesTogether,
              topMeal: couplesDNA.allTimeNumber1Together?.mealName ?? "",
              topCuisine: couplesDNA.mutualCuisines[0]?.cuisine ?? "",
              avgMatchTime,
              partnerId: selectedPartnerId ?? undefined,
            } satisfies CouplesFlavor;
          })()}
          onShare={() => {/* handled internally by CouplesFlavorCard */}}
          onSave={() => {/* handled internally by CouplesFlavorCard */}}
          onClose={() => setShowProfileCouplesCard(false)}
        />
      )}

      {/* ── Hidden off-screen export surface for html2canvas ─────────────────
          Rendered at natural 390×694 (no CSS scaling). html2canvas upscales
          to 1080×1920 via its scale option at capture time.
      ──────────────────────────────────────────────────────────────────── */}
      {soloDNA && flavorType && revealOpen && (
        <div
          ref={exportCardRef}
          className="fixed overflow-hidden bg-black"
          style={{ left: -9999, top: 0, width: 390, height: 694 }}
          aria-hidden="true"
        >
          <FlavorTypeCard
            flavorType={flavorType}
            userName={displayName || undefined}
            soloDNA={soloDNA}
            hardNos={hardNosList.length ? hardNosList : undefined}
            exportMode
          />
        </div>
      )}
    </main>
  );
}
