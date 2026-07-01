"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════════════════════════════════════

type TimeRange = "24h" | "7d" | "30d" | "all";
type TabId =
  | "overview"
  | "funnel"
  | "onboarding"
  | "sessions"
  | "friction"
  | "meals"
  | "users"
  | "feedback";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "funnel", label: "Funnel" },
  { id: "onboarding", label: "Onboarding" },
  { id: "sessions", label: "Sessions" },
  { id: "friction", label: "Friction" },
  { id: "meals", label: "Meals" },
  { id: "users", label: "Users" },
  { id: "feedback", label: "Feedback" },
];

type AEvent = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any> | null;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  user_id: string | null;
  message: string;
  page_context: string | null;
  user_agent: string | null;
  created_at: string;
};

// Candlelight palette
const C = {
  bg: "#0B0805",
  surface: "#1C1A18",
  surface2: "#2A2420",
  surface3: "#3D3733",
  border: "rgba(255,255,255,0.06)",
  accent: "#E8621A",
  accentDim: "rgba(232,98,26,0.15)",
  text: "#F6EEE2",
  textMid: "#C7BDAC",
  muted: "#897E73",
  red: "#C0392B",
  redDim: "rgba(192,57,43,0.15)",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function getCutoff(range: TimeRange): string | null {
  if (range === "24h")
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (range === "7d")
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d")
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return ((num / den) * 100).toFixed(1) + "%";
}

function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((x): x is T => x != null))];
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

// Safe property access — handles inconsistent field names across event versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prop(p: Record<string, any> | null | undefined, ...keys: string[]): any {
  if (!p) return undefined;
  for (const k of keys) if (p[k] !== undefined && p[k] !== null) return p[k];
  return undefined;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isRlsError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("policy") ||
    m.includes("permission") ||
    m.includes("42501") ||
    m.includes("denied") ||
    m.includes("row-level") ||
    m.includes("rls")
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Layer — read-only, zero writes
// ═══════════════════════════════════════════════════════════════════════════════

type FetchResult<T> =
  | { data: T; blocked: false; error: null }
  | { data: null; blocked: true; error: string }
  | { data: null; blocked: false; error: string };

async function qEvents(
  names: string[],
  cutoff: string | null,
  limit = 10000,
): Promise<FetchResult<AEvent[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("analytics_events")
    .select("id, user_id, session_id, event_name, properties, created_at")
    .in("event_name", names)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cutoff) q = q.gte("created_at", cutoff);
  const { data, error } = await q;
  if (error) {
    if (isRlsError(error.message))
      return { data: null, blocked: true, error: error.message };
    return { data: null, blocked: false, error: error.message };
  }
  return { data: (data as AEvent[]) ?? [], blocked: false, error: null };
}

async function qTable<T>(
  table: string,
  select: string,
  cutoff: string | null,
  cutoffCol = "created_at",
  limit = 10000,
): Promise<FetchResult<T[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select(select).limit(limit);
  if (cutoff) q = q.gte(cutoffCol, cutoff);
  const { data, error } = await q;
  if (error) {
    if (isRlsError(error.message))
      return { data: null, blocked: true, error: error.message };
    return { data: null, blocked: false, error: error.message };
  }
  return { data: (data as T[]) ?? [], blocked: false, error: null };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared UI Components
// ═══════════════════════════════════════════════════════════════════════════════

function Skeleton({ h = 18, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        background: C.surface2,
        borderRadius: 6,
        flexShrink: 0,
      }}
    />
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          color: C.muted,
          fontSize: 11,
          fontFamily: "var(--font-manrope)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent ? C.accent : C.text,
          fontSize: 32,
          fontFamily: "var(--font-nunito)",
          fontWeight: 900,
          lineHeight: 1.1,
          margin: "2px 0",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            color: C.muted,
            fontSize: 12,
            fontFamily: "var(--font-manrope)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Skeleton h={10} w="50%" />
      <Skeleton h={30} w="40%" />
      <Skeleton h={10} w="60%" />
    </div>
  );
}

function RlsWall({ table }: { table: string }) {
  return (
    <div
      style={{
        background: C.redDim,
        border: "1px solid rgba(192,57,43,0.4)",
        borderRadius: 12,
        padding: "14px 18px",
      }}
    >
      <div
        style={{
          color: "#E07060",
          fontWeight: 700,
          fontFamily: "var(--font-manrope)",
          fontSize: 14,
          marginBottom: 6,
        }}
      >
        Blocked by RLS — admin read policy needed for{" "}
        <code
          style={{
            background: C.surface,
            padding: "2px 6px",
            borderRadius: 4,
            color: C.text,
          }}
        >
          {table}
        </code>
      </div>
      <div
        style={{
          color: C.muted,
          fontFamily: "var(--font-manrope)",
          fontSize: 12,
        }}
      >
        Fix:{" "}
        <code
          style={{
            background: C.surface,
            padding: "2px 6px",
            borderRadius: 4,
            color: C.textMid,
          }}
        >
          {`CREATE POLICY "admin_read_${table}" ON public.${table} FOR SELECT USING (true);`}
        </code>
      </div>
    </div>
  );
}

function Empty({ msg = "No data yet" }: { msg?: string }) {
  return (
    <div
      style={{
        color: C.muted,
        fontSize: 13,
        padding: "20px 0",
        textAlign: "center",
        fontFamily: "var(--font-manrope)",
      }}
    >
      {msg}
    </div>
  );
}

function Card({
  title,
  children,
  loading,
}: {
  title?: string;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      {title && (
        <div
          style={{
            color: C.muted,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--font-manrope)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 16,
          }}
        >
          {title}
        </div>
      )}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton />
          <Skeleton w="80%" />
          <Skeleton w="60%" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Bar({
  value,
  max,
  label,
  sub,
  color = C.accent,
}: {
  value: number;
  max: number;
  label: string;
  sub?: string;
  color?: string;
}) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1 : 0) : 0;
  return (
    <div style={{ padding: "2px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span
          style={{
            color: C.textMid,
            fontSize: 13,
            fontFamily: "var(--font-manrope)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "70%",
          }}
        >
          {label}
        </span>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}
        >
          {sub && (
            <span
              style={{
                color: C.muted,
                fontSize: 11,
                fontFamily: "var(--font-manrope)",
              }}
            >
              {sub}
            </span>
          )}
          <span
            style={{
              color: C.text,
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "var(--font-manrope)",
              minWidth: 32,
              textAlign: "right",
            }}
          >
            {fmt(value)}
          </span>
        </div>
      </div>
      <div
        style={{ background: C.surface2, borderRadius: 4, height: 6 }}
      >
        <div
          style={{
            width: `${w}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

function DataTable({
  cols,
  rows,
}: {
  cols: string[];
  rows: (string | number | null | undefined)[][];
}) {
  if (!rows.length) return <Empty />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--font-manrope)",
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  color: C.muted,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "6px 10px 10px",
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                background:
                  ri % 2 ? "rgba(255,255,255,0.015)" : "transparent",
              }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: ci === 0 ? "left" : "right",
                    color: ci === 0 ? C.textMid : C.text,
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: ci === 0 ? 500 : 400,
                    whiteSpace: ci === 0 ? "normal" : "nowrap",
                  }}
                >
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span
        style={{
          color: C.textMid,
          fontSize: 13,
          fontFamily: "var(--font-manrope)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent ? C.accent : C.text,
          fontWeight: 700,
          fontSize: 14,
          fontFamily: "var(--font-manrope)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Overview
// ═══════════════════════════════════════════════════════════════════════════════

const OVERVIEW_EVENTS = [
  "session_started",
  "decision_locked",
  "locked_result_viewed",
  "post_decision_action",
  "match_created",
];

function OverviewTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blockedAE, setBlockedAE] = useState(false);
  const [events, setEvents] = useState<AEvent[]>([]);
  const [returnCount, setReturnCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      qEvents(OVERVIEW_EVENTS, cutoff),
      qTable<{ returned_within_10min: boolean | null }>(
        "user_sessions",
        "returned_within_10min",
        cutoff,
        "opened_at",
      ),
    ]).then(([aeRes, usRes]) => {
      if (aeRes.blocked) {
        setBlockedAE(true);
      } else {
        setEvents(aeRes.data ?? []);
      }
      setReturnCount(
        (usRes.blocked ? [] : (usRes.data ?? [])).filter(
          (s) => s.returned_within_10min,
        ).length,
      );
      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
        <Card loading>
          <></>
        </Card>
      </div>
    );
  }

  if (blockedAE) return <RlsWall table="analytics_events" />;

  const byName = groupBy(events, (e) => e.event_name);
  const ss = byName["session_started"] ?? [];
  const dl = byName["decision_locked"] ?? [];
  const lrv = byName["locked_result_viewed"] ?? [];
  const pda = byName["post_decision_action"] ?? [];
  const mc = byName["match_created"] ?? [];

  const sharedCount = ss.filter((e) => {
    const m = prop(e.properties, "sessionMode", "mode", "session_mode");
    return m === "shared";
  }).length;

  const positions = mc
    .map((e) => {
      const p = prop(
        e.properties,
        "card_position",
        "cardPosition",
        "position",
      );
      return typeof p === "number" ? p : null;
    })
    .filter((p): p is number => p !== null);

  const avgPos = avg(positions);
  const uSS = uniq(ss.map((e) => e.user_id)).length;
  const uDL = uniq(dl.map((e) => e.user_id)).length;

  const funnel = [
    { label: "session_started", count: ss.length },
    { label: "decision_locked", count: dl.length },
    { label: "locked_result_viewed", count: lrv.length },
    { label: "post_decision_action", count: pda.length },
  ];
  const fmax = funnel[0].count;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: 14,
        }}
      >
        <MetricCard
          label="Decision Completion Rate"
          value={pct(uDL, uSS)}
          sub={`${fmt(uDL)} of ${fmt(uSS)} unique users locked`}
          accent
        />
        <MetricCard
          label="Shared Session Rate"
          value={pct(sharedCount, ss.length)}
          sub={`${fmt(sharedCount)} of ${fmt(ss.length)} starts`}
        />
        <MetricCard
          label="10-Min Return Signal"
          value={fmt(returnCount)}
          sub="sessions with returned_within_10min (user_sessions)"
        />
        <MetricCard
          label="Avg Match Position"
          value={avgPos != null ? avgPos.toFixed(1) : "—"}
          sub="card position at match_created"
        />
      </div>

      <Card title="Core Funnel — drop-off at each step">
        {fmax === 0 ? (
          <Empty />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {funnel.map((step, i) => {
              const prev = i > 0 ? funnel[i - 1].count : null;
              const drop =
                prev != null && prev > 0
                  ? (((prev - step.count) / prev) * 100).toFixed(1)
                  : null;
              return (
                <div key={step.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        color: C.textMid,
                        fontSize: 13,
                        fontFamily: "var(--font-manrope)",
                        fontWeight: 500,
                      }}
                    >
                      {step.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      {drop != null && (
                        <span
                          style={{
                            color: C.accent,
                            fontSize: 11,
                            fontFamily: "var(--font-manrope)",
                            fontWeight: 600,
                          }}
                        >
                          ↓ {drop}% drop
                        </span>
                      )}
                      <span
                        style={{
                          color: C.text,
                          fontWeight: 700,
                          fontSize: 15,
                          fontFamily: "var(--font-nunito)",
                        }}
                      >
                        {fmt(step.count)}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{ background: C.surface2, borderRadius: 4, height: 8 }}
                  >
                    <div
                      style={{
                        width:
                          fmax > 0
                            ? `${(step.count / fmax) * 100}%`
                            : "0%",
                        height: "100%",
                        background: C.accent,
                        borderRadius: 4,
                        opacity: 1 - i * 0.17,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Funnel
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_FUNNEL_EVENTS = [
  "session_started",
  "deck_swipe",
  "card_swiped_yes",
  "card_swiped_no",
  "match_created",
  "watchas_call_triggered",
  "decision_locked",
  "locked_result_viewed",
  "post_decision_action",
];

type FunnelRow = {
  name: string;
  total: number;
  unique: number;
  solo: number;
  shared: number;
  conv: string | null;
  drop: number | null;
};

function FunnelTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [rows, setRows] = useState<FunnelRow[]>([]);

  useEffect(() => {
    setLoading(true);
    qEvents(ALL_FUNNEL_EVENTS, cutoff).then((res) => {
      if (res.blocked) {
        setBlocked(true);
        setLoading(false);
        return;
      }
      const events = res.data ?? [];
      const byName = groupBy(events, (e) => e.event_name);

      // Merge deck_swipe (with decision property) + legacy card_swiped_yes/no
      const swipeYes = [
        ...(byName["deck_swipe"] ?? []).filter(
          (e) => prop(e.properties, "decision") === "yes",
        ),
        ...(byName["card_swiped_yes"] ?? []),
      ];
      const swipeNo = [
        ...(byName["deck_swipe"] ?? []).filter(
          (e) => prop(e.properties, "decision") === "no",
        ),
        ...(byName["card_swiped_no"] ?? []),
      ];
      const allSwipes = [...swipeYes, ...swipeNo];

      const steps: { name: string; events: AEvent[] }[] = [
        { name: "session_started", events: byName["session_started"] ?? [] },
        { name: "card_swiped (yes + no)", events: allSwipes },
        { name: "card_swiped_yes", events: swipeYes },
        { name: "card_swiped_no", events: swipeNo },
        { name: "match_created", events: byName["match_created"] ?? [] },
        {
          name: "watchas_call_triggered",
          events: byName["watchas_call_triggered"] ?? [],
        },
        { name: "decision_locked", events: byName["decision_locked"] ?? [] },
        {
          name: "locked_result_viewed",
          events: byName["locked_result_viewed"] ?? [],
        },
        {
          name: "post_decision_action",
          events: byName["post_decision_action"] ?? [],
        },
      ];

      // Conversion reference points — measure conv from session_started, match, or previous step
      const convRef: Record<number, number> = {
        0: steps[0].events.length, // session_started → itself
        1: steps[0].events.length, // swipes from session_started
        2: steps[1].events.length, // yes from all swipes
        3: steps[1].events.length, // no from all swipes
        4: steps[0].events.length, // match from session_started
        5: steps[0].events.length, // watchas from session_started
        6: steps[0].events.length, // locked from session_started
        7: steps[6].events.length, // result viewed from locked
        8: steps[7].events.length, // post action from result viewed
      };

      const result: FunnelRow[] = steps.map((step, i) => {
        const ref = convRef[i] ?? null;
        return {
          name: step.name,
          total: step.events.length,
          unique: uniq(step.events.map((e) => e.user_id)).length,
          solo: step.events.filter((e) => {
            const m = prop(
              e.properties,
              "sessionMode",
              "mode",
              "session_mode",
            );
            return m !== "shared";
          }).length,
          shared: step.events.filter((e) => {
            const m = prop(
              e.properties,
              "sessionMode",
              "mode",
              "session_mode",
            );
            return m === "shared";
          }).length,
          conv:
            ref != null && i > 0 ? pct(step.events.length, ref) : null,
          drop:
            i > 0 && ref != null ? ref - step.events.length : null,
        };
      });

      setRows(result);
      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading)
    return (
      <Card loading>
        <></>
      </Card>
    );
  if (blocked) return <RlsWall table="analytics_events" />;

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card title="Full Event Funnel">
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-manrope)",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {[
                "Event",
                "Total",
                "Unique Users",
                "Solo",
                "Shared",
                "Conv. Rate",
                "Drop-off",
              ].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    color: C.muted,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "6px 10px 12px",
                    borderBottom: `1px solid ${C.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background:
                    i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.textMid,
                    fontWeight: 500,
                    minWidth: 200,
                  }}
                >
                  <div>{row.name}</div>
                  <div
                    style={{
                      background: C.surface2,
                      borderRadius: 2,
                      height: 3,
                      marginTop: 5,
                    }}
                  >
                    <div
                      style={{
                        width: `${(row.total / maxTotal) * 100}%`,
                        height: "100%",
                        background: C.accent,
                        borderRadius: 2,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.text,
                    fontWeight: 700,
                  }}
                >
                  {fmt(row.total)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.textMid,
                  }}
                >
                  {fmt(row.unique)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.muted,
                  }}
                >
                  {fmt(row.solo)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.muted,
                  }}
                >
                  {fmt(row.shared)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color: row.conv ? C.text : C.muted,
                  }}
                >
                  {row.conv ?? "—"}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "9px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    color:
                      row.drop != null && row.drop > 0
                        ? C.accent
                        : C.muted,
                  }}
                >
                  {row.drop != null ? fmt(row.drop) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Onboarding
// ═══════════════════════════════════════════════════════════════════════════════

const ONBOARDING_EVENTS = [
  "onboarding_step_viewed",
  "onboarding_step_completed",
  "onboarding_abandoned",
];

function OnboardingTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [events, setEvents] = useState<AEvent[]>([]);

  useEffect(() => {
    setLoading(true);
    qEvents(ONBOARDING_EVENTS, cutoff).then((res) => {
      if (res.blocked) {
        setBlocked(true);
        setLoading(false);
        return;
      }
      setEvents(res.data ?? []);
      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading)
    return (
      <Card loading>
        <></>
      </Card>
    );
  if (blocked) return <RlsWall table="analytics_events" />;

  const viewed = events.filter(
    (e) => e.event_name === "onboarding_step_viewed",
  );
  const completed = events.filter(
    (e) => e.event_name === "onboarding_step_completed",
  );
  const abandoned = events.filter(
    (e) => e.event_name === "onboarding_abandoned",
  );

  // Collect all step identifiers
  const stepKeys = uniq([
    ...viewed.map((e) =>
      String(
        prop(e.properties, "step_name", "stepName", "step") ?? "unknown",
      ),
    ),
    ...completed.map((e) =>
      String(
        prop(e.properties, "step_name", "stepName", "step") ?? "unknown",
      ),
    ),
  ]);

  const tableRows: (string | number | null | undefined)[][] = stepKeys.map(
    (step) => {
      const vEvs = viewed.filter(
        (e) =>
          String(
            prop(e.properties, "step_name", "stepName", "step") ?? "unknown",
          ) === step,
      );
      const cEvs = completed.filter(
        (e) =>
          String(
            prop(e.properties, "step_name", "stepName", "step") ?? "unknown",
          ) === step,
      );
      const stepNum =
        vEvs[0] != null
          ? prop(
              vEvs[0].properties,
              "step_number",
              "stepNumber",
              "step_num",
              "stepIndex",
            )
          : null;
      const timesMs = cEvs
        .map((e) => {
          const t = prop(
            e.properties,
            "time_on_step_ms",
            "duration_ms",
            "time_ms",
            "timeMs",
          );
          return typeof t === "number" ? t : null;
        })
        .filter((t): t is number => t !== null);
      const avgMs = avg(timesMs);

      return [
        step,
        stepNum != null ? String(stepNum) : "—",
        vEvs.length,
        cEvs.length,
        pct(cEvs.length, vEvs.length),
        avgMs != null ? (avgMs / 1000).toFixed(1) + "s" : "—",
        vEvs.length - cEvs.length,
      ];
    },
  );

  const byAbandonStep = groupBy(abandoned, (e) =>
    String(
      prop(
        e.properties,
        "step_name",
        "stepName",
        "abandoned_at_step",
        "step",
      ) ?? "unknown",
    ),
  );
  const abandonMax = Math.max(...Object.values(byAbandonStep).map((v) => v.length), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="Per-Step Completion">
        {tableRows.length === 0 ? (
          <Empty />
        ) : (
          <DataTable
            cols={[
              "Step Name",
              "#",
              "Viewed",
              "Completed",
              "Rate",
              "Avg Time",
              "Drop-off",
            ]}
            rows={tableRows}
          />
        )}
      </Card>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <MetricCard
            label="Total Abandonments"
            value={fmt(abandoned.length)}
            sub="onboarding_abandoned events"
          />
          <MetricCard
            label="Total Step Views"
            value={fmt(viewed.length)}
            sub="onboarding_step_viewed events"
          />
          <MetricCard
            label="Total Completions"
            value={fmt(completed.length)}
            sub="onboarding_step_completed events"
          />
        </div>
        <Card title="Abandonment by Step (highest drop-off)">
          {Object.keys(byAbandonStep).length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(byAbandonStep)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([step, evs]) => (
                  <Bar
                    key={step}
                    label={step}
                    value={evs.length}
                    max={abandonMax}
                    color={C.red}
                  />
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Sessions
// ═══════════════════════════════════════════════════════════════════════════════

const SESSION_EVENTS = [
  "watchas_call_triggered",
  "session_started",
  "vibe_selected",
  "decision_locked",
];

type UserSessionRow = {
  session_type: string | null;
  swipe_count: number;
  time_to_decision_seconds: number | null;
  vibe: string | null;
  resolved: boolean;
};

function SessionsTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blockedUS, setBlockedUS] = useState(false);
  const [blockedAE, setBlockedAE] = useState(false);
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [watchasEvs, setWatchasEvs] = useState<AEvent[]>([]);
  const [ssEvs, setSsEvs] = useState<AEvent[]>([]);
  const [vibeEvs, setVibeEvs] = useState<AEvent[]>([]);
  const [dlEvs, setDlEvs] = useState<AEvent[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      qTable<UserSessionRow>(
        "user_sessions",
        "session_type, swipe_count, time_to_decision_seconds, vibe, resolved",
        cutoff,
        "opened_at",
      ),
      qEvents(SESSION_EVENTS, cutoff),
    ]).then(([usRes, aeRes]) => {
      if (usRes.blocked) setBlockedUS(true);
      else setSessions(usRes.data ?? []);

      if (aeRes.blocked) {
        setBlockedAE(true);
      } else {
        const byName = groupBy(aeRes.data ?? [], (e) => e.event_name);
        setWatchasEvs(byName["watchas_call_triggered"] ?? []);
        setSsEvs(byName["session_started"] ?? []);
        setVibeEvs(byName["vibe_selected"] ?? []);
        setDlEvs(byName["decision_locked"] ?? []);
      }
      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
    );
  }

  const total = sessions.length;
  const solo = sessions.filter((s) => s.session_type === "solo").length;
  const shared = sessions.filter((s) => s.session_type === "shared").length;
  const unknown = total - solo - shared;

  const swipeCounts = sessions
    .map((s) => s.swipe_count)
    .filter((n) => n != null && !isNaN(n));
  const ttds = sessions
    .map((s) => s.time_to_decision_seconds)
    .filter((n): n is number => n != null);

  const avgSwipes = avg(swipeCounts);
  const avgTTD = avg(ttds);

  const vibeByType = groupBy(vibeEvs, (e) =>
    String(
      prop(e.properties, "vibe", "vibe_type", "vibeType", "vibeMode") ??
        "unknown",
    ),
  );
  const vibeMax = Math.max(
    ...Object.values(vibeByType).map((v) => v.length),
    1,
  );

  const watchasTotal = watchasEvs.length;
  const ssTotal = ssEvs.length;
  const watchasSolo = watchasEvs.filter(
    (e) => prop(e.properties, "sessionMode", "mode", "session_mode") !== "shared",
  ).length;
  const watchasShared = watchasEvs.filter(
    (e) => prop(e.properties, "sessionMode", "mode", "session_mode") === "shared",
  ).length;

  // Sessions resolved via Watcha's Call vs direct match
  const resolvedViaWatchas = dlEvs.filter((e) => {
    const path = prop(
      e.properties,
      "resolutionPath",
      "resolution_path",
      "resolvedVia",
    );
    return path === "watchas_call" || path === "watcha";
  }).length;
  const resolvedDirect = dlEvs.length - resolvedViaWatchas;

  // Vibe from user_sessions
  const sessionVibes = groupBy(
    sessions.filter((s) => s.vibe),
    (s) => s.vibe!,
  );
  const sessionVibeMax = Math.max(
    ...Object.values(sessionVibes).map((v) => v.length),
    1,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {blockedUS && <RlsWall table="user_sessions" />}
      {blockedAE && <RlsWall table="analytics_events" />}

      {!blockedUS && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 14,
            }}
          >
            <MetricCard
              label="Solo Sessions"
              value={fmt(solo)}
              sub={`${pct(solo, total)} of ${fmt(total)} total`}
            />
            <MetricCard
              label="Shared Sessions"
              value={fmt(shared)}
              sub={`${pct(shared, total)} of ${fmt(total)} total`}
            />
            {unknown > 0 && (
              <MetricCard
                label="Unknown Type"
                value={fmt(unknown)}
                sub="no session_type recorded"
              />
            )}
            <MetricCard
              label="Avg Swipes / Session"
              value={avgSwipes != null ? avgSwipes.toFixed(1) : "—"}
              sub="from user_sessions.swipe_count"
            />
            <MetricCard
              label="Avg Time to Decision"
              value={avgTTD != null ? avgTTD.toFixed(0) + "s" : "—"}
              sub="from user_sessions.time_to_decision_seconds"
            />
          </div>

          {Object.keys(sessionVibes).length > 0 && (
            <Card title="Vibe Distribution (user_sessions)">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(sessionVibes)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([vibe, rows]) => (
                    <Bar
                      key={vibe}
                      label={vibe}
                      value={rows.length}
                      max={sessionVibeMax}
                    />
                  ))}
              </div>
            </Card>
          )}
        </>
      )}

      {!blockedAE && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card title="Watcha's Call">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <StatRow
                label="Trigger Rate"
                value={`${pct(watchasTotal, ssTotal)} (${fmt(watchasTotal)} / ${fmt(ssTotal)} sessions)`}
                accent
              />
              <StatRow
                label="Solo triggers"
                value={`${fmt(watchasSolo)} (${pct(watchasSolo, watchasTotal)})`}
              />
              <StatRow
                label="Shared triggers"
                value={`${fmt(watchasShared)} (${pct(watchasShared, watchasTotal)})`}
              />
              <StatRow
                label="Resolved via Watcha's Call"
                value={fmt(resolvedViaWatchas)}
              />
              <StatRow
                label="Resolved via direct match"
                value={fmt(resolvedDirect)}
              />
            </div>
          </Card>

          <Card title="Vibe Distribution (vibe_selected events)">
            {Object.keys(vibeByType).length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(vibeByType)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([vibe, evs]) => (
                    <Bar
                      key={vibe}
                      label={vibe}
                      value={evs.length}
                      max={vibeMax}
                    />
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5 — Friction
// ═══════════════════════════════════════════════════════════════════════════════

const FRICTION_EVENTS = [
  "error_shown_to_user",
  "guest_limit_reached",
  "guest_signup_prompted",
  "shared_session_abandoned",
  "shared_invite_created",
  "shared_invite_joined",
];

function FrictionTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [events, setEvents] = useState<AEvent[]>([]);

  useEffect(() => {
    setLoading(true);
    qEvents(FRICTION_EVENTS, cutoff).then((res) => {
      if (res.blocked) {
        setBlocked(true);
        setLoading(false);
        return;
      }
      setEvents(res.data ?? []);
      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading)
    return (
      <Card loading>
        <></>
      </Card>
    );
  if (blocked) return <RlsWall table="analytics_events" />;

  const byName = groupBy(events, (e) => e.event_name);
  const errors = byName["error_shown_to_user"] ?? [];
  const guestLimit = byName["guest_limit_reached"] ?? [];
  const guestSignup = byName["guest_signup_prompted"] ?? [];
  const abandoned = byName["shared_session_abandoned"] ?? [];
  const inviteCreated = byName["shared_invite_created"] ?? [];
  const inviteJoined = byName["shared_invite_joined"] ?? [];

  const errorByCtx = groupBy(errors, (e) =>
    String(
      prop(
        e.properties,
        "error_context",
        "errorContext",
        "context",
        "error_type",
        "type",
      ) ?? "unknown",
    ),
  );
  const guestByTrigger = groupBy(guestLimit, (e) =>
    String(
      prop(
        e.properties,
        "trigger_source",
        "triggerSource",
        "trigger",
        "source",
      ) ?? "unknown",
    ),
  );
  const abandonByStep = groupBy(abandoned, (e) =>
    String(
      prop(
        e.properties,
        "abandoned_at_step",
        "abandonedAtStep",
        "step",
        "at_step",
      ) ?? "unknown",
    ),
  );
  const inviteByMethod = groupBy(inviteCreated, (e) =>
    String(
      prop(
        e.properties,
        "invite_method",
        "inviteMethod",
        "method",
        "type",
      ) ?? "unknown",
    ),
  );

  const swipeCountsAtAbandon = abandoned
    .map((e) => {
      const c = prop(
        e.properties,
        "swipe_count_at_abandon",
        "swipeCountAtAbandon",
        "swipe_count",
        "swipeCount",
      );
      return typeof c === "number" ? c : null;
    })
    .filter((c): c is number => c !== null);
  const avgSwipeAtAbandon = avg(swipeCountsAtAbandon);

  const errorMax = Math.max(
    ...Object.values(errorByCtx).map((v) => v.length),
    1,
  );
  const guestMax = Math.max(
    ...Object.values(guestByTrigger).map((v) => v.length),
    1,
  );
  const abandonMax = Math.max(
    ...Object.values(abandonByStep).map((v) => v.length),
    1,
  );
  const inviteMax = Math.max(
    ...Object.values(inviteByMethod).map((v) => v.length),
    1,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Errors */}
      <Card title="Errors Shown to Users — sorted by frequency">
        {errors.length === 0 ? (
          <Empty msg="No errors recorded" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(errorByCtx)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([ctx, evs]) => (
                <Bar
                  key={ctx}
                  label={ctx}
                  value={evs.length}
                  max={errorMax}
                  color={C.red}
                />
              ))}
          </div>
        )}
      </Card>

      {/* Guest Friction */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <Card title="Guest Limit Reached — by trigger_source">
          {guestLimit.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(guestByTrigger)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([src, evs]) => (
                  <Bar
                    key={src}
                    label={src}
                    value={evs.length}
                    max={guestMax}
                  />
                ))}
            </div>
          )}
        </Card>

        <Card title="Guest Signup Prompted">
          {guestSignup.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  color: C.text,
                  fontSize: 40,
                  fontWeight: 900,
                  fontFamily: "var(--font-nunito)",
                }}
              >
                {fmt(guestSignup.length)}
              </div>
              <div
                style={{
                  color: C.muted,
                  fontSize: 12,
                  fontFamily: "var(--font-manrope)",
                }}
              >
                guest_signup_prompted events. Exact conversion to signup
                requires a server-side join on user_id across sessions.
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Shared Session Abandonment */}
      <Card title="Shared Session Abandonment">
        <div
          style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24 }}
        >
          <div>
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                fontFamily: "var(--font-manrope)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Total Abandoned
            </div>
            <div
              style={{
                color: C.text,
                fontSize: 40,
                fontWeight: 900,
                fontFamily: "var(--font-nunito)",
              }}
            >
              {fmt(abandoned.length)}
            </div>
            {avgSwipeAtAbandon != null && (
              <div
                style={{
                  color: C.muted,
                  fontSize: 12,
                  fontFamily: "var(--font-manrope)",
                  marginTop: 6,
                }}
              >
                Avg {avgSwipeAtAbandon.toFixed(1)} swipes at abandon
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(abandonByStep).length === 0 ? (
              <Empty />
            ) : (
              Object.entries(abandonByStep)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([step, evs]) => (
                  <Bar
                    key={step}
                    label={step}
                    value={evs.length}
                    max={abandonMax}
                    color={C.accent}
                  />
                ))
            )}
          </div>
        </div>
      </Card>

      {/* Invite Funnel */}
      <Card title="Invite Funnel">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: C.surface2,
              borderRadius: 12,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-manrope)",
                marginBottom: 4,
              }}
            >
              Invites Created
            </div>
            <div
              style={{
                color: C.text,
                fontSize: 28,
                fontWeight: 900,
                fontFamily: "var(--font-nunito)",
              }}
            >
              {fmt(inviteCreated.length)}
            </div>
          </div>
          <div
            style={{
              background: C.surface2,
              borderRadius: 12,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-manrope)",
                marginBottom: 4,
              }}
            >
              Invites Joined
            </div>
            <div
              style={{
                color: C.text,
                fontSize: 28,
                fontWeight: 900,
                fontFamily: "var(--font-nunito)",
              }}
            >
              {fmt(inviteJoined.length)}
            </div>
          </div>
          <div
            style={{
              background: C.accentDim,
              border: `1px solid rgba(232,98,26,0.2)`,
              borderRadius: 12,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-manrope)",
                marginBottom: 4,
              }}
            >
              Join Rate
            </div>
            <div
              style={{
                color: C.accent,
                fontSize: 28,
                fontWeight: 900,
                fontFamily: "var(--font-nunito)",
              }}
            >
              {pct(inviteJoined.length, inviteCreated.length)}
            </div>
          </div>
        </div>

        {Object.keys(inviteByMethod).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                color: C.muted,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "var(--font-manrope)",
                marginBottom: 4,
              }}
            >
              By invite_method
            </div>
            {Object.entries(inviteByMethod)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([method, evs]) => (
                <Bar
                  key={method}
                  label={method}
                  value={evs.length}
                  max={inviteMax}
                />
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 6 — Meals
// ═══════════════════════════════════════════════════════════════════════════════

const MEAL_EVENTS = [
  "decision_locked",
  "deck_swipe",
  "card_swiped_no",
  "post_decision_action",
  "meal_saved",
  "watchas_call_triggered",
];

type DecisionRow = {
  meal_id: string;
  meal_name: string;
  is_ai_generated: boolean;
  outcome: string;
};

function MealsTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blockedAE, setBlockedAE] = useState(false);
  const [blockedDec, setBlockedDec] = useState(false);
  const [events, setEvents] = useState<AEvent[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      qEvents(MEAL_EVENTS, cutoff),
      qTable<DecisionRow>(
        "decisions",
        "meal_id, meal_name, is_ai_generated, outcome",
        cutoff,
        "decided_at",
      ),
    ]).then(([aeRes, decRes]) => {
      if (aeRes.blocked) setBlockedAE(true);
      else setEvents(aeRes.data ?? []);

      if (decRes.blocked) setBlockedDec(true);
      else setDecisions(decRes.data ?? []);

      setLoading(false);
    });
  }, [cutoff, rk]);

  if (loading)
    return (
      <Card loading>
        <></>
      </Card>
    );

  const byName = groupBy(events, (e) => e.event_name);

  // Top locked meals
  const lockedEvs = byName["decision_locked"] ?? [];
  const lockedByMeal = groupBy(lockedEvs, (e) => {
    const name = prop(e.properties, "mealName", "meal_name");
    const id = prop(e.properties, "mealId", "meal_id", "mealID");
    return String(name ?? id ?? "unknown");
  });
  const topLocked = Object.entries(lockedByMeal)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  // Top passed meals
  const noEvs = [
    ...(byName["deck_swipe"] ?? []).filter(
      (e) => prop(e.properties, "decision") === "no",
    ),
    ...(byName["card_swiped_no"] ?? []),
  ];
  const noByMeal = groupBy(noEvs, (e) => {
    const name = prop(e.properties, "mealName", "meal_name");
    const id = prop(e.properties, "mealId", "meal_id");
    return String(name ?? id ?? "unknown");
  });
  const topPassed = Object.entries(noByMeal)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  // Watcha's Call winners
  const watchasEvs = byName["watchas_call_triggered"] ?? [];
  const watchasByMeal = groupBy(watchasEvs, (e) => {
    const name = prop(
      e.properties,
      "mealName",
      "meal_name",
      "resolvedMealName",
    );
    const id = prop(
      e.properties,
      "mealId",
      "meal_id",
      "resolved_meal_id",
      "resolvedMealId",
    );
    return String(name ?? id ?? "unknown");
  });
  const topWatchas = Object.entries(watchasByMeal)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  // Cook vs order
  const pdaEvs = byName["post_decision_action"] ?? [];
  const byAction = groupBy(pdaEvs, (e) =>
    String(
      prop(
        e.properties,
        "action_type",
        "actionType",
        "action",
        "intent",
      ) ?? "unknown",
    ),
  );
  const actionMax = Math.max(
    ...Object.values(byAction).map((v) => v.length),
    1,
  );

  // Saved meals
  const savedEvs = byName["meal_saved"] ?? [];

  // AI meals (from decisions table)
  const aiDecisions = decisions.filter((d) => d.is_ai_generated);
  const aiAccepted = aiDecisions.filter((d) => d.outcome === "accepted").length;

  const lockedMax = topLocked[0]?.[1].length ?? 1;
  const passedMax = topPassed[0]?.[1].length ?? 1;
  const watchasMax = topWatchas[0]?.[1].length ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {blockedAE && <RlsWall table="analytics_events" />}
      {blockedDec && <RlsWall table="decisions" />}

      {!blockedAE && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <Card title="Top 20 Most Locked Meals">
              {topLocked.length === 0 ? (
                <Empty />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {topLocked.map(([meal, evs]) => (
                    <Bar
                      key={meal}
                      label={meal}
                      value={evs.length}
                      max={lockedMax}
                      color={C.accent}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Top 20 Most Passed Meals">
              {topPassed.length === 0 ? (
                <Empty />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {topPassed.map(([meal, evs]) => (
                    <Bar
                      key={meal}
                      label={meal}
                      value={evs.length}
                      max={passedMax}
                      color={C.muted}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <Card title="Top 10 Watcha's Call Winners">
              {topWatchas.length === 0 ? (
                <Empty />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {topWatchas.map(([meal, evs]) => (
                    <Bar
                      key={meal}
                      label={meal}
                      value={evs.length}
                      max={watchasMax}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Cook vs Order (post_decision_action)">
              {pdaEvs.length === 0 ? (
                <Empty />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {Object.entries(byAction)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([action, evs]) => (
                      <Bar
                        key={action}
                        label={action}
                        value={evs.length}
                        max={actionMax}
                      />
                    ))}
                </div>
              )}
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <MetricCard
              label="Meal Saves (meal_saved)"
              value={fmt(savedEvs.length)}
              sub="total save actions in time range"
            />
            {!blockedDec && (
              <MetricCard
                label="AI Meal Acceptance Rate"
                value={pct(aiAccepted, aiDecisions.length)}
                sub={`${fmt(aiAccepted)} accepted of ${fmt(aiDecisions.length)} AI-generated decisions`}
                accent
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 7 — Users
// ═══════════════════════════════════════════════════════════════════════════════

type UserSessionFreq = {
  user_id: string;
  opened_at: string;
  session_type: string | null;
  returned_within_10min: boolean | null;
};

function UsersTab({ cutoff, rk }: { cutoff: string | null; rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blockedAE, setBlockedAE] = useState(false);
  const [blockedUS, setBlockedUS] = useState(false);
  const [ssEvents, setSsEvents] = useState<AEvent[]>([]);
  const [userSessions, setUserSessions] = useState<UserSessionFreq[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [blockedProfiles, setBlockedProfiles] = useState(false);
  const [totalProfiles, setTotalProfiles] = useState<number | null>(null);
  const [completedOnboarding, setCompletedOnboarding] = useState<number | null>(null);
  const [googleUsers, setGoogleUsers] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      qEvents(["session_started"], cutoff),
      qTable<UserSessionFreq>(
        "user_sessions",
        "user_id, opened_at, session_type, returned_within_10min",
        cutoff,
        "opened_at",
      ),
    ]).then(([aeRes, usRes]) => {
      if (aeRes.blocked) setBlockedAE(true);
      else setSsEvents(aeRes.data ?? []);

      if (usRes.blocked) setBlockedUS(true);
      else setUserSessions(usRes.data ?? []);

      setLoading(false);
    });
  }, [cutoff, rk]);

  useEffect(() => {
    setProfilesLoading(true);
    Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("onboarding_completed_at", "is", null),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("auth_user_id", "is", null),
    ]).then(([totalRes, completedRes, authRes]) => {
      const errMsg =
        totalRes.error?.message ||
        completedRes.error?.message ||
        authRes.error?.message;
      if (errMsg) {
        if (isRlsError(errMsg)) setBlockedProfiles(true);
        setProfilesLoading(false);
        return;
      }
      setTotalProfiles(totalRes.count);
      setCompletedOnboarding(completedRes.count);
      setGoogleUsers(authRes.count);
      setProfilesLoading(false);
    });
  }, [rk]);

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
    );
  }

  const uniqueUsers = uniq(ssEvents.map((e) => e.user_id)).length;
  const authUsers = uniq(
    ssEvents
      .filter((e) => {
        const isGuest = e.properties?.isGuest;
        const isAuthenticated =
          isGuest === false || isGuest === null || isGuest === undefined;
        return isAuthenticated;
      })
      .map((e) => e.user_id),
  ).length;

  const returnCount = userSessions.filter(
    (s) => s.returned_within_10min,
  ).length;

  // Session frequency per user
  const sessionsByUser = groupBy(userSessions, (s) => s.user_id);
  const freqBuckets: Record<string, number> = {
    "1 session": 0,
    "2–5 sessions": 0,
    "6–10 sessions": 0,
    "10+ sessions": 0,
  };
  Object.values(sessionsByUser).forEach((rows) => {
    const n = rows.length;
    if (n === 1) freqBuckets["1 session"]++;
    else if (n <= 5) freqBuckets["2–5 sessions"]++;
    else if (n <= 10) freqBuckets["6–10 sessions"]++;
    else freqBuckets["10+ sessions"]++;
  });
  const freqMax = Math.max(...Object.values(freqBuckets), 1);

  // Top 10 most active by session count
  const topUsers = Object.entries(sessionsByUser)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  // New users per day — last 30 days from session_started events
  const today = new Date();
  const thirtyDayLabels = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  // First seen day per user_id
  const firstSeenByUser: Record<string, string> = {};
  ssEvents.forEach((e) => {
    if (!e.user_id) return;
    const day = e.created_at.slice(0, 10);
    if (!firstSeenByUser[e.user_id] || day < firstSeenByUser[e.user_id]) {
      firstSeenByUser[e.user_id] = day;
    }
  });

  const newPerDay: Record<string, number> = {};
  Object.values(firstSeenByUser).forEach((day) => {
    if (thirtyDayLabels.includes(day)) {
      newPerDay[day] = (newPerDay[day] ?? 0) + 1;
    }
  });
  const dayMax = Math.max(...Object.values(newPerDay), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {blockedAE && <RlsWall table="analytics_events" />}
      {blockedUS && <RlsWall table="user_sessions" />}

      {!blockedAE && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          <MetricCard
            label="Total Unique Users"
            value={fmt(uniqueUsers)}
            sub="distinct user_id in session_started events"
          />
          <MetricCard
            label="Authenticated"
            value={fmt(authUsers)}
            sub={`${pct(authUsers, uniqueUsers)} with auth marker`}
          />
          <MetricCard
            label="Guest / Anon"
            value={fmt(uniqueUsers - authUsers)}
            sub="no auth marker in events"
          />
          {!blockedUS && (
            <MetricCard
              label="Return Signal"
              value={fmt(returnCount)}
              sub="returned_within_10min sessions"
            />
          )}
        </div>
      )}

      {!blockedUS && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Card title="Session Frequency Distribution">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(freqBuckets).map(([bucket, count]) => (
                <Bar
                  key={bucket}
                  label={bucket}
                  value={count}
                  max={freqMax}
                />
              ))}
            </div>
          </Card>

          <Card title="Top 10 Most Active Users (user_id only — no PII)">
            <DataTable
              cols={["User ID (truncated)", "Sessions"]}
              rows={topUsers.map(([uid, rows]) => [
                uid.slice(0, 12) + "…",
                rows.length,
              ])}
            />
          </Card>
        </div>
      )}

      {!blockedAE && (
        <Card title="New Users Per Day — Last 30 Days (first session_started)">
          {Object.keys(newPerDay).length === 0 ? (
            <Empty />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  alignItems: "flex-end",
                  height: 90,
                  padding: "0 0 4px",
                }}
              >
                {thirtyDayLabels.map((day) => {
                  const count = newPerDay[day] ?? 0;
                  const h =
                    dayMax > 0
                      ? Math.max((count / dayMax) * 80, count > 0 ? 3 : 0)
                      : 0;
                  return (
                    <div
                      key={day}
                      title={`${day}: ${count} new users`}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        height: 80,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: h,
                          background: count > 0 ? C.accent : C.surface3,
                          borderRadius: "2px 2px 0 0",
                          opacity: count > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    color: C.muted,
                    fontSize: 10,
                    fontFamily: "var(--font-manrope)",
                  }}
                >
                  {thirtyDayLabels[0]}
                </span>
                <span
                  style={{
                    color: C.muted,
                    fontSize: 10,
                    fontFamily: "var(--font-manrope)",
                  }}
                >
                  {thirtyDayLabels[29]}
                </span>
              </div>
            </>
          )}
        </Card>
      )}
      {/* Profile Stats */}
      {profilesLoading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          {[0, 1, 2].map((i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      )}
      {!profilesLoading && blockedProfiles && <RlsWall table="profiles" />}
      {!profilesLoading && !blockedProfiles && (
        <>
          <div
            style={{
              color: C.muted,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--font-manrope)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginTop: 4,
            }}
          >
            Profile Stats (from profiles table)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 14,
            }}
          >
            <MetricCard
              label="Total Profiles Created"
              value={totalProfiles != null ? fmt(totalProfiles) : "—"}
              sub="rows in profiles table"
            />
            <MetricCard
              label="Onboarding Completed"
              value={completedOnboarding != null ? fmt(completedOnboarding) : "—"}
              sub={
                totalProfiles && completedOnboarding != null
                  ? `${pct(completedOnboarding, totalProfiles)} of total`
                  : "onboarding_completed_at not null"
              }
              accent
            />
            <MetricCard
              label="Authenticated Accounts"
              value={googleUsers != null ? fmt(googleUsers) : "—"}
              sub={
                totalProfiles && googleUsers != null
                  ? `${pct(googleUsers, totalProfiles)} of total`
                  : "auth_user_id not null"
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 8 — Feedback
// ═══════════════════════════════════════════════════════════════════════════════

function FeedbackTab({ rk }: { rk: number }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("feedback")
      .select("id, user_id, message, page_context, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          if (isRlsError(error.message)) setBlocked(true);
          setLoading(false);
          return;
        }
        setRows((data as FeedbackRow[]) ?? []);
        setLoading(false);
      });
  }, [rk]);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {[0, 1, 2].map((i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
        <Card loading>
          <></>
        </Card>
      </div>
    );
  }

  if (blocked) return <RlsWall table="feedback" />;

  const total = rows.length;
  const fromHomepage = rows.filter((r) => r.page_context === "homepage").length;
  const fromProfile = rows.filter((r) => r.page_context === "profile").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <MetricCard
          label="Total Submissions"
          value={fmt(total)}
          sub="feedback rows (latest 200)"
          accent
        />
        <MetricCard
          label="From Homepage"
          value={fmt(fromHomepage)}
          sub={`${pct(fromHomepage, total)} of total`}
        />
        <MetricCard
          label="From Profile"
          value={fmt(fromProfile)}
          sub={`${pct(fromProfile, total)} of total`}
        />
      </div>

      {/* Feedback table */}
      <Card title="Feedback submissions — newest first">
        {rows.length === 0 ? (
          <Empty msg="No feedback submitted yet. Check back after launch." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-manrope)",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  {(["Time", "Context", "Message", "User"] as const).map(
                    (h, i) => (
                      <th
                        key={i}
                        style={{
                          textAlign: "left",
                          color: C.muted,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "6px 12px 10px",
                          borderBottom: `1px solid ${C.border}`,
                          whiteSpace: "nowrap",
                          width: i === 2 ? "100%" : undefined,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr
                    key={row.id}
                    style={{
                      background:
                        ri % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                    }}
                  >
                    {/* Time — relative, absolute on hover */}
                    <td
                      title={new Date(row.created_at).toLocaleString()}
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.border}`,
                        color: C.muted,
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                        cursor: "default",
                      }}
                    >
                      {timeAgo(row.created_at)}
                    </td>
                    {/* Context pill */}
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.border}`,
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.page_context ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 100,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              row.page_context === "homepage"
                                ? C.accentDim
                                : C.surface3,
                            color:
                              row.page_context === "homepage"
                                ? C.accent
                                : C.muted,
                          }}
                        >
                          {row.page_context}
                        </span>
                      ) : (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </td>
                    {/* Message — full text, no truncation */}
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.border}`,
                        color: C.textMid,
                        verticalAlign: "top",
                        minWidth: 300,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {row.message}
                    </td>
                    {/* User — truncated to 8 chars or "Guest" */}
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${C.border}`,
                        color: C.muted,
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {row.user_id ? row.user_id.slice(0, 8) + "…" : "Guest"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Copy all as JSON */}
      {rows.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleCopy}
            style={{
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "6px 14px",
              color: copied ? C.accent : C.textMid,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-manrope)",
              transition: "color 0.15s",
            }}
          >
            {copied ? "✓ Copied!" : "Copy all as JSON"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Dashboard — auth gate then render
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authState, setAuthState] = useState<"loading" | "ok">("loading");
  const [range, setRange] = useState<TimeRange>("7d");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Step 1: loading state
  // ── Step 2: auth check — do NOT query any data before this resolves
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const adminId = process.env.NEXT_PUBLIC_ADMIN_USER_ID;
      if (data?.user?.id && adminId && data.user.id === adminId) {
        setAuthState("ok");
        setLastUpdated(new Date());
      } else {
        // ── Step 3: no match → redirect
        router.replace("/");
      }
    });
  }, [router]);

  // Sync tab from ?tab= URL param
  useEffect(() => {
    const tab = searchParams.get("tab") as TabId | null;
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, [searchParams]);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    setLastUpdated(new Date());
  };

  // ── Step 1: Show loading state before auth resolves
  if (authState === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            color: C.accent,
            fontSize: 22,
            fontFamily: "var(--font-nunito)",
            fontWeight: 900,
          }}
        >
          🔥
        </div>
        <div
          style={{
            color: C.muted,
            fontFamily: "var(--font-manrope)",
            fontSize: 14,
          }}
        >
          Checking auth…
        </div>
      </div>
    );
  }

  // ── Step 4: Confirmed admin — render dashboard
  // (cutoff calculated in TypeScript per Guardrail 3 — no SQL interval syntax)
  const cutoff = getCutoff(range);

  return (
    <div
      style={{ minHeight: "100vh", background: C.bg, fontFamily: "var(--font-manrope)" }}
    >
      {/* Header bar */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                color: C.text,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font-nunito)",
              }}
            >
              Watcha Wanna Eat
            </span>
            <span
              style={{
                color: C.muted,
                fontSize: 15,
                fontWeight: 400,
              }}
            >
              / Analytics
            </span>
            <span
              style={{
                background: C.accentDim,
                color: C.accent,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 100,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontFamily: "var(--font-manrope)",
              }}
            >
              Admin
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {/* Time range selector */}
            <div
              style={{
                display: "flex",
                gap: 2,
                background: C.surface2,
                borderRadius: 8,
                padding: 3,
              }}
            >
              {(["24h", "7d", "30d", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "var(--font-manrope)",
                    background: range === r ? C.accent : "transparent",
                    color: range === r ? "#fff" : C.muted,
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {r === "all" ? "All time" : r}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={refresh}
              style={{
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "5px 14px",
                color: C.textMid,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-manrope)",
              }}
            >
              ↻ Refresh
            </button>

            {/* Last updated */}
            {lastUpdated && (
              <span
                style={{
                  color: C.muted,
                  fontSize: 11,
                  fontFamily: "var(--font-manrope)",
                  flexShrink: 0,
                }}
              >
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            gap: 0,
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "12px 18px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-manrope)",
                color: activeTab === tab.id ? C.accent : C.muted,
                borderBottom:
                  activeTab === tab.id
                    ? `2px solid ${C.accent}`
                    : "2px solid transparent",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — only rendered after auth confirmed */}
      <div
        style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px 60px" }}
      >
        {activeTab === "overview" && (
          <OverviewTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "funnel" && (
          <FunnelTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "onboarding" && (
          <OnboardingTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "sessions" && (
          <SessionsTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "friction" && (
          <FrictionTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "meals" && (
          <MealsTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "users" && (
          <UsersTab cutoff={cutoff} rk={refreshKey} />
        )}
        {activeTab === "feedback" && <FeedbackTab rk={refreshKey} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page export — Suspense required for useSearchParams in Next.js App Router
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0B0805",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              color: "#897E73",
              fontFamily: "var(--font-manrope)",
              fontSize: 14,
            }}
          >
            Loading…
          </div>
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
