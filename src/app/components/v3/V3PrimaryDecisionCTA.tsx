"use client";

import { useRef, useState } from "react";

interface V3PrimaryDecisionCTAProps {
  isSolo?: boolean;
  hasGuests?: boolean;
  onClick?: () => void;
}

const THUMB_W = 52;
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
    // Remove transition class after animation completes
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
      // Small pause so user sees the completed slide before routing
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

  return (
    <div className="mx-[14px] mb-[10px] shrink-0">
      <div
        ref={containerRef}
        className="relative h-[62px] rounded-full border border-[#E8621A]/[0.22] overflow-hidden select-none touch-none"
        style={{ background: "rgba(232,98,26,0.08)" }}
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
            background: "linear-gradient(90deg, #E8621A 0%, rgba(232,98,26,0.18) 100%)",
            transition: snap ? "width 0.3s ease" : "none",
          }}
        />

        {/* Draggable thumb */}
        <div
          className="absolute top-[5px] bottom-[5px] w-[52px] bg-[#E8621A] rounded-full flex items-center justify-center text-[22px] z-[3]"
          style={{
            left: `${thumbX + TRACK_PAD}px`,
            boxShadow: "0 4px 14px rgba(232,98,26,0.45)",
            transition: snap ? "left 0.3s ease" : "none",
            cursor: dragging.current ? "grabbing" : "grab",
          }}
        >
          🍽️
        </div>

        {/* Label — fades as thumb slides over it */}
        <div
          className="absolute left-[68px] right-[38px] top-0 bottom-0 flex flex-col justify-center pointer-events-none z-[2]"
          style={{ opacity: Math.max(0, 1 - thumbX / 80) }}
        >
          <div
            className="text-[15px] font-black leading-[1.2]"
            style={{ fontFamily: "var(--font-nunito)", color: "rgba(232,98,26,0.9)" }}
          >
            {title}
          </div>
          <div
            className="text-[11px]"
            style={{ fontFamily: "var(--font-manrope)", color: "rgba(232,98,26,0.5)" }}
          >
            {sub}
          </div>
        </div>

        {/* Hint arrows */}
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-[2] text-[13px] tracking-[-3px]"
          style={{ color: "rgba(232,98,26,0.3)" }}
        >
          &gt;&gt;&gt;
        </div>
      </div>
    </div>
  );
}
