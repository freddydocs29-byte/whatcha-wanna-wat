"use client";

import { useRef, useState } from "react";

interface V3PrimaryDecisionCTAProps {
  isSolo?: boolean;
  hasGuests?: boolean;
  onClick?: () => void;
}

const THUMB_W = 54;
const TRACK_PAD = 5;
const THRESHOLD = 0.65;

export default function V3PrimaryDecisionCTA({
  isSolo = false,
  hasGuests = false,
  onClick,
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

  const fillWidth = thumbX + THUMB_W + TRACK_PAD;
  const progress = thumbX / Math.max(1, (containerRef.current?.clientWidth ?? 300) - THUMB_W - TRACK_PAD * 2);

  return (
    <div className="mx-[14px] mb-[10px] shrink-0">
      <div
        ref={containerRef}
        className="relative h-[64px] rounded-full overflow-hidden select-none touch-none"
        style={{
          background: "rgba(232,98,26,0.07)",
          border: "1.5px solid rgba(232,98,26,0.28)",
          boxShadow: "0 0 20px rgba(232,98,26,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Gradient fill that grows with the thumb */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full pointer-events-none"
          style={{
            width: `${fillWidth}px`,
            background: "linear-gradient(90deg, rgba(232,98,26,0.55) 0%, rgba(232,98,26,0.08) 100%)",
            transition: snap ? "width 0.3s ease" : "none",
          }}
        />

        {/* Draggable thumb */}
        <div
          className="absolute top-[5px] bottom-[5px] flex items-center justify-center text-[22px] z-[3] rounded-full"
          style={{
            width: `${THUMB_W}px`,
            left: `${thumbX + TRACK_PAD}px`,
            background: "linear-gradient(145deg, #F07828, #D8551A)",
            boxShadow: "0 3px 18px rgba(232,98,26,0.60), 0 1px 4px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
            transition: snap ? "left 0.3s ease" : "none",
            cursor: dragging.current ? "grabbing" : "grab",
          }}
        >
          🍽️
        </div>

        {/* Label — fades as thumb slides over it */}
        <div
          className="absolute left-[72px] right-[38px] top-0 bottom-0 flex flex-col justify-center pointer-events-none z-[2]"
          style={{ opacity: Math.max(0, 1 - (progress * 1.2)) }}
        >
          <div
            className="text-[15px] font-black leading-[1.2]"
            style={{ fontFamily: "var(--font-nunito)", color: "rgba(232,98,26,0.95)" }}
          >
            {title}
          </div>
          <div
            className="text-[11px] mt-[1px]"
            style={{ fontFamily: "var(--font-manrope)", color: "rgba(232,98,26,0.50)" }}
          >
            {sub}
          </div>
        </div>

        {/* Chevron hints */}
        <div
          className="absolute right-[14px] top-1/2 -translate-y-1/2 pointer-events-none z-[2] flex gap-[2px]"
          style={{ opacity: Math.max(0.15, 0.38 - progress * 0.38) }}
        >
          {["›", "›", "›"].map((c, i) => (
            <span
              key={i}
              className="text-[16px] font-bold leading-none"
              style={{
                color: "#E8621A",
                opacity: 1 - i * 0.28,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
