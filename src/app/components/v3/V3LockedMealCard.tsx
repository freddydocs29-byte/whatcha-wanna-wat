"use client";
import { useRef, useState } from "react";

interface V3LockedMealCardProps {
  mealName?: string;
  tags?: string;
  cookTime?: string;
  spice?: string;
  matchScore?: string;
  onClear?: () => void;
  onSave?: () => void;
  onDetails?: () => void;
  onCook?: () => void;
  onOrder?: () => void;
  isSaved?: boolean;
  savedJustNow?: boolean;
}

// Bookmark icon — small, clean
function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z" />
    </svg>
  );
}

// Check icon — shown briefly after saving
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Expand/detail icon — opens meal detail view
function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

const THRESHOLD = 75;

export default function V3LockedMealCard({
  mealName = "Tikka Masala",
  tags = "Indian • Creamy • Spicy",
  cookTime = "30-40 min",
  spice = "🌶️🌶️🌶️",
  matchScore = "98% Match",
  onClear,
  onSave,
  onDetails,
  onCook,
  onOrder,
  isSaved = false,
  savedJustNow = false,
}: V3LockedMealCardProps) {
  const [dragX, setDragX] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const didTrigger = useRef(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isDragging.current = true;
    didTrigger.current = false;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || didTrigger.current) return;
    const dx = e.clientX - startX.current;
    setDragX(Math.max(-THRESHOLD * 1.15, Math.min(THRESHOLD * 1.15, dx)));
  }

  function handlePointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!didTrigger.current) {
      if (dragX <= -THRESHOLD) {
        didTrigger.current = true;
        onCook?.();
      } else if (dragX >= THRESHOLD) {
        didTrigger.current = true;
        onOrder?.();
      }
    }
    setDragX(0);
  }

  const cookProgress = Math.max(0, Math.min(1, -dragX / THRESHOLD));
  const orderProgress = Math.max(0, Math.min(1, dragX / THRESHOLD));
  const clampedDrag = Math.max(-THRESHOLD * 1.1, Math.min(THRESHOLD * 1.1, dragX));
  const isMoving = dragX !== 0;

  // Direction-aware visual state
  const cookActive = cookProgress > 0.04;
  const orderActive = orderProgress > 0.04;

  const glassBase =
    "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 24px rgba(0,0,0,0.22), 0 12px 32px rgba(0,0,0,0.28)";
  const trackGlow = cookActive
    ? `${glassBase}, 0 0 28px rgba(94,158,110,${0.12 + cookProgress * 0.28})`
    : orderActive
      ? `${glassBase}, 0 0 28px rgba(232,98,26,${0.12 + orderProgress * 0.28})`
      : `${glassBase}, 0 0 28px rgba(232,98,26,0.10)`;

  const cookLabelColor = cookActive
    ? `rgba(134,169,114,${0.7 + cookProgress * 0.3})`
    : orderActive
      ? `rgba(58,53,50,${0.55 + orderProgress * 0.45})`
      : "#C7BDAC";

  const orderLabelColor = orderActive
    ? `rgba(255,138,61,${0.7 + orderProgress * 0.3})`
    : cookActive
      ? `rgba(58,53,50,${0.55 + cookProgress * 0.45})`
      : "#C7BDAC";

  const centerGlowBg = cookActive
    ? `rgba(94,158,110,${0.18 + cookProgress * 0.32})`
    : orderActive
      ? `rgba(232,98,26,${0.15 + orderProgress * 0.32})`
      : "rgba(245,237,224,0.10)";

  const centerTextColor = cookActive
    ? `rgba(210,240,215,${0.60 + cookProgress * 0.40})`
    : orderActive
      ? `rgba(255,218,180,${0.60 + orderProgress * 0.40})`
      : "#F5EDE0";

  const arrowColor = cookActive
    ? `rgba(134,169,114,${0.50 + cookProgress * 0.40})`
    : orderActive
      ? `rgba(255,138,61,${0.50 + orderProgress * 0.40})`
      : "rgba(199,189,172,0.55)";

  return (
    <div
      className="mx-[14px] mb-3 rounded-[18px] px-4 py-[14px] relative overflow-hidden shrink-0"
      style={{
        background: "rgba(255,231,202,0.07)",
        border: "1px solid rgba(245,237,224,0.14)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 28px rgba(0,0,0,0.40)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Green resolution glow hairline at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, rgba(106,175,122,0.85) 20%, rgba(106,175,122,0.95) 50%, rgba(106,175,122,0.85) 80%, transparent 100%)",
          boxShadow: "0 0 10px rgba(106,175,122,0.45)",
        }}
      />

      {/* Label */}
      <div
        className="text-[9px] font-bold tracking-[2px] uppercase text-[#6BAF7A] mb-[5px]"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        DINNER IS LOCKED IN
      </div>

      {/* Meal name row */}
      <div className="flex justify-between items-start mb-[3px]">
        <div>
          <div
            className="text-xl font-black text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            {mealName}
          </div>
          <div
            className="text-xs text-[#8A7F78] mb-[10px]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {tags}
          </div>
        </div>

        {/* Small utility icon buttons: bookmark · info · clear */}
        <div className="flex gap-[6px] items-center mt-[2px] shrink-0">
          {/* "Saved!" label — appears briefly after saving */}
          {savedJustNow && (
            <span
              className="text-[10px] font-bold text-[#6BAF7A]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Saved!
            </span>
          )}

          {/* Save / Bookmark */}
          <button
            onClick={onSave}
            title={isSaved ? "Saved" : "Save meal"}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center cursor-pointer transition-all"
            style={
              isSaved
                ? {
                    background: "rgba(74,124,89,0.22)",
                    border: "1px solid rgba(106,175,122,0.45)",
                    color: "#6BAF7A",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }
                : {
                    background: "rgba(255,231,202,0.07)",
                    border: "1px solid rgba(245,237,224,0.12)",
                    color: "#8A7F78",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }
            }
          >
            {savedJustNow ? <CheckIcon /> : <BookmarkIcon />}
          </button>

          {/* Details / Info */}
          <button
            onClick={onDetails}
            title="Meal details"
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center cursor-pointer transition-all"
            style={{
              background: "rgba(255,231,202,0.07)",
              border: "1px solid rgba(245,237,224,0.12)",
              color: "#8A7F78",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <ExpandIcon />
          </button>

          {/* Clear / Change — hidden for guests (onClear not provided) */}
          {onClear && (
            <button
              onClick={onClear}
              title="Change meal"
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs cursor-pointer shrink-0 transition-all"
              style={{
                background: "rgba(255,231,202,0.07)",
                border: "1px solid rgba(245,237,224,0.12)",
                color: "#8A7F78",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-[6px] mb-[10px]">
        {[
          { icon: "⏱️", main: cookTime, sub: "Total time", green: false },
          { icon: "🌶️", main: spice, sub: "Spice Level", green: false },
          { icon: "✓", main: matchScore, sub: "Great pick!", green: true },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-[10px] px-2 py-[7px] flex items-center gap-[5px]"
            style={{
              background: "rgba(255,231,202,0.055)",
              border: "1px solid rgba(245,237,224,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span
              className={`text-[11px] shrink-0 ${stat.green ? "text-[#6BAF7A]" : ""}`}
            >
              {stat.icon}
            </span>
            <div>
              <div
                className={`text-[10px] font-bold leading-[1.2] ${
                  stat.green ? "text-[#6BAF7A]" : "text-white"
                }`}
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {stat.main}
              </div>
              <div
                className="text-[9px] text-[#5A5350]"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {stat.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Let's Eat bidirectional swipe + tap — interactive */}
      <p style={{
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#897E73",
        marginBottom: 8,
      }}>
        ← swipe to cook or order
      </p>
      <div>
        <div className="flex justify-between px-1 mb-[6px]">
          <button
            className="text-[11px] select-none"
            style={{
              fontFamily: "var(--font-manrope)",
              color: cookLabelColor,
              transition: isMoving ? "none" : "color 0.22s ease",
              background: "none",
              border: "none",
              padding: "11px 6px",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationColor: "rgba(199,189,172,0.3)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              didTrigger.current = true;
              onCook?.();
            }}
          >
            ← Cook
          </button>
          <button
            className="text-[11px] select-none"
            style={{
              fontFamily: "var(--font-manrope)",
              color: orderLabelColor,
              transition: isMoving ? "none" : "color 0.22s ease",
              background: "none",
              border: "none",
              padding: "11px 6px",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationColor: "rgba(199,189,172,0.3)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              didTrigger.current = true;
              onOrder?.();
            }}
          >
            Order →
          </button>
        </div>

        <div
          className="relative h-[54px] rounded-[14px] overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            background: "linear-gradient(180deg, rgba(255,231,202,0.10) 0%, rgba(255,231,202,0.035) 100%)",
            border: "1px solid rgba(245,237,224,0.14)",
            boxShadow: trackGlow,
            transition: isMoving ? "none" : "box-shadow 0.22s ease",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Cook reveal layer — green, fades in as user drags left */}
          <div
            className="absolute inset-0"
            style={{
              background: `rgba(74,124,89,${cookProgress})`,
              transition: isMoving ? "none" : "background 0.2s",
            }}
          />
          {/* Order reveal layer — orange, fades in as user drags right */}
          <div
            className="absolute inset-0"
            style={{
              background: `rgba(232,98,26,${orderProgress})`,
              transition: isMoving ? "none" : "background 0.2s",
            }}
          />

          {/* Cook label — revealed on left drag */}
          <div
            className="absolute left-[18px] inset-y-0 flex items-center pointer-events-none"
            style={{ opacity: cookProgress }}
          >
            <span
              className="text-[15px] font-black text-white"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              We&apos;re cooking
            </span>
          </div>

          {/* Order label — revealed on right drag */}
          <div
            className="absolute right-[18px] inset-y-0 flex items-center pointer-events-none"
            style={{ opacity: orderProgress }}
          >
            <span
              className="text-[15px] font-black text-white"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              Let&apos;s order
            </span>
          </div>

          {/* Center label — floats freely over the glass rail, no border/box */}
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center gap-[7px]"
            style={{
              transform: `translateX(${clampedDrag}px)`,
              opacity: Math.max(0, 1 - Math.max(cookProgress, orderProgress) * 1.5),
              transition: isMoving ? "none" : "transform 0.25s ease, opacity 0.22s ease",
            }}
          >
            {/* Soft radial glow behind text — no hard edges */}
            <div
              style={{
                position: "absolute",
                width: 160,
                height: 44,
                borderRadius: 22,
                background: centerGlowBg,
                filter: "blur(14px)",
                transition: isMoving ? "none" : "background 0.22s ease",
              }}
            />
            <span
              style={{
                position: "relative",
                fontFamily: "var(--font-manrope)",
                fontSize: 11,
                color: arrowColor,
                transition: isMoving ? "none" : "color 0.22s ease",
              }}
            >
              ←
            </span>
            <span
              style={{
                position: "relative",
                fontFamily: "var(--font-nunito)",
                fontWeight: 900,
                fontSize: 15,
                color: centerTextColor,
                transition: isMoving ? "none" : "color 0.22s ease",
              }}
            >
              Let&apos;s Eat
            </span>
            <span
              style={{
                position: "relative",
                fontFamily: "var(--font-manrope)",
                fontSize: 11,
                color: arrowColor,
                transition: isMoving ? "none" : "color 0.22s ease",
              }}
            >
              →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
