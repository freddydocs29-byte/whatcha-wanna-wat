"use client";

import { useRef, useState } from "react";

interface V3PrimaryDecisionCTAProps {
  isSolo?: boolean;
  hasGuests?: boolean;
  onClick?: () => void;
  /** Optional: called when the "ring the house" / "decide together" secondary link is tapped.
   *  Wires to the existing invite drawer (setShowInviteDrawer). */
  onDecideTogether?: () => void;
}

const THUMB_W = 54;
const TRACK_PAD = 7;
const THRESHOLD = 0.65;

export default function V3PrimaryDecisionCTA({
  isSolo = false,
  hasGuests = false,
  onClick,
  onDecideTogether,
}: V3PrimaryDecisionCTAProps) {
  const title =
    isSolo ? "Start my deck" : hasGuests ? "Start our decision" : "Start my deck";
  const sub =
    isSolo ? "Solo, just for you" : hasGuests ? "Everyone's in. Let's go!" : "Add someone or go solo";

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startClientX = useRef(0);
  const triggered = useRef(false);
  const thumbXRef = useRef(0);
  const [thumbX, setThumbX] = useState(0);
  const [snap, setSnap] = useState(false);

  function getMaxX(): number {
    const w = containerRef.current?.clientWidth ?? 300;
    return Math.max(0, w - THUMB_W - TRACK_PAD * 2);
  }

  function snapBack() {
    setSnap(true);
    thumbXRef.current = 0;
    setThumbX(0);
    setTimeout(() => setSnap(false), 320);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (triggered.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    startClientX.current = e.clientX - thumbXRef.current;
    setSnap(false);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || triggered.current) return;
    const rawX = e.clientX - startClientX.current;
    const maxX = getMaxX();
    const x = Math.max(0, Math.min(rawX, maxX));
    thumbXRef.current = x;
    setThumbX(x);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const maxX = getMaxX();
    if (thumbXRef.current >= maxX * THRESHOLD && !triggered.current) {
      triggered.current = true;
      thumbXRef.current = maxX;
      setThumbX(maxX);
      setTimeout(() => onClick?.(), 150);
    } else {
      snapBack();
    }
  }

  function onPointerCancel() {
    if (!dragging.current) return;
    dragging.current = false;
    snapBack();
  }

  const maxX = containerRef.current
    ? Math.max(0, containerRef.current.clientWidth - THUMB_W - TRACK_PAD * 2)
    : 300 - THUMB_W - TRACK_PAD * 2;
  const progress = thumbX / Math.max(1, maxX);
  const labelOpacity = Math.max(0, 1 - progress * 1.2);

  return (
    <div style={{ margin: "0 14px 10px" }}>
      {/* Dimensional gradient CTA track — styled like the Candlelight solid button,
          but retains the slide-to-start gesture underneath */}
      <div
        ref={containerRef}
        className="relative select-none touch-none overflow-hidden"
        style={{
          height: 66,
          borderRadius: 22,
          padding: `${TRACK_PAD}px`,
          background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 46%, #B84A12 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,224,188,0.7), " +
            "inset 0 -2px 0 rgba(120,52,0,0.4), " +
            "0 18px 38px rgba(232,98,26,0.4), " +
            "0 0 0 1px rgba(232,98,26,0.34), " +
            "0 0 60px rgba(232,98,26,0.18)",
          cursor: dragging.current ? "grabbing" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Sheen sweep — diagonal highlight that crosses every ~4.5s */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none candlelight-animate"
          style={{
            left: "-40%",
            width: "32%",
            background:
              "linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)",
            transform: "skewX(-18deg)",
            animation: "candlelight-sheen 4.5s ease-in-out infinite",
          }}
        />

        {/* Draggable thumb — translucent tile with plate icon */}
        <div
          className="absolute flex items-center justify-center z-[3]"
          style={{
            top: TRACK_PAD,
            bottom: TRACK_PAD,
            width: THUMB_W,
            left: thumbX + TRACK_PAD,
            borderRadius: 16,
            background:
              "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.32), rgba(255,255,255,0.06))",
            border: "1px solid rgba(255,255,255,0.3)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
            transition: snap ? "left 0.3s ease" : "none",
            cursor: dragging.current ? "grabbing" : "grab",
          }}
        >
          {/* Plate-and-cutlery icon using borders */}
          <span
            className="relative flex items-center justify-center"
            style={{ width: 24, height: 24 }}
            aria-hidden="true"
          >
            {/* Plate circle */}
            <span
              className="absolute"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid #2a1206",
              }}
            />
            {/* Inner ring */}
            <span
              className="absolute"
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "1.5px solid rgba(42,18,6,0.5)",
              }}
            />
            {/* Fork handle above */}
            <span
              className="absolute"
              style={{
                left: "50%",
                top: -4,
                transform: "translateX(-50%)",
                width: 2,
                height: 7,
                background: "#2a1206",
                borderRadius: 2,
                boxShadow: "-4px 0 0 #2a1206, 4px 0 0 #2a1206",
              }}
            />
          </span>
        </div>

        {/* Text label — fades out as thumb slides */}
        <div
          className="absolute flex flex-col justify-center pointer-events-none z-[2]"
          style={{
            left: THUMB_W + TRACK_PAD * 2 + 8,
            right: 40,
            top: 0,
            bottom: 0,
            opacity: labelOpacity,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 18,
              color: "#1c0c03",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 500,
              fontSize: 12,
              color: "rgba(28,12,3,0.72)",
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        </div>

        {/* Chevrons — right side, fade as progress increases */}
        <div
          className="absolute flex items-center pointer-events-none z-[2]"
          style={{
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            gap: 1,
            opacity: Math.max(0.15, 0.38 - progress * 0.38),
          }}
        >
          {["›", "›", "›"].map((c, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontWeight: 500,
                fontSize: 16,
                color: "#1c0c03",
                opacity: 1 - i * 0.28,
                lineHeight: 1,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Secondary "decide together" link — wires to existing invite flow */}
      {isSolo && onDecideTogether && (
        <div className="text-center" style={{ marginTop: 14 }}>
          <span
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 400,
              fontSize: 12,
              color: "#C7BDAC",
            }}
          >
            or decide together —{" "}
            <button
              onClick={onDecideTogether}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "inherit",
                fontSize: "inherit",
                fontWeight: 500,
                color: "#E8621A",
                cursor: "pointer",
              }}
            >
              ring the house
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
