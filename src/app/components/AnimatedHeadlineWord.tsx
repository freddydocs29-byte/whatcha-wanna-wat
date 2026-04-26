"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimate } from "framer-motion";

// All words stacked in the reel, top-to-bottom. "tonight?" is the final target.
const REEL = [
  "for breakfast?",
  "for dinner?",
  "for lunch?",
  "for breakfast?",
  "for dinner?",
  "for lunch?",
  "for breakfast?",
  "for dinner?",
  "for lunch?",
  "tonight?",
];

// Keyframe progress values for each reel position.
// Tightly packed early = fast spin. Spread apart late = deceleration.
const TIMES = [0, 0.05, 0.10, 0.15, 0.22, 0.32, 0.45, 0.61, 0.79, 1.0];

// Window blur per keyframe: heavy during fast spin, clears as it lands.
const BLUR = [
  "blur(7px)", "blur(7px)", "blur(7px)", "blur(6px)", "blur(5px)",
  "blur(3px)", "blur(1.5px)", "blur(0.5px)", "blur(0px)", "blur(0px)",
];

// Total animation duration in seconds
const DURATION = 1.45;

export function AnimatedHeadlineWord() {
  // windowRef: the clipping window. Also used for slot-height measurement + blur animation.
  const windowRef = useRef<HTMLSpanElement>(null);
  // reelScope: the full strip of stacked words that scrolls upward.
  const [reelScope, animate] = useAnimate();

  useEffect(() => {
    const win = windowRef.current;
    if (!win) return;

    // One slot = the rendered height of the window (= one line of heading text).
    // Every word in the reel is the same height, so this is the scroll unit.
    const slotH = win.getBoundingClientRect().height;
    if (slotH === 0) return;

    // y-position for each keyframe: word[i] is visible when y = -(i * slotH)
    const yValues = REEL.map((_, i) => -(i * slotH));

    // Each segment between words eases out — smooth stop per click.
    // Deceleration across the whole animation comes from non-uniform TIMES.
    const segEase = Array(REEL.length - 1).fill("easeOut") as string[];

    // Brief pause before spin — lets the page paint first
    const t = setTimeout(() => {
      // Scroll the reel strip upward through all words to "tonight?"
      animate(
        reelScope.current,
        { y: yValues },
        { duration: DURATION, times: TIMES, ease: segEase },
      );

      // Blur the window in lockstep: fast = blurry, slow = sharp
      animate(
        win,
        { filter: BLUR },
        { duration: DURATION, times: TIMES, ease: "easeOut" },
      );
    }, 150);

    return () => clearTimeout(t);
  // animate is stable; reelScope.current is the ref value at call time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /*
     * WINDOW — the visible slot. overflow:hidden clips the reel so only
     * one word is visible at a time. Its height = one line of heading text,
     * measured from the ghost element inside it.
     *
     * verticalAlign:baseline keeps it flush with the surrounding "eating" line.
     * overflow:hidden + filter:blur() applies motion blur to the visible slice.
     */
    <span
      ref={windowRef}
      style={{
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
        verticalAlign: "baseline",
        filter: "blur(7px)", // initial blurred state before animation fires
      }}
    >
      {/*
       * GHOST — invisible, never moves. Always renders "for breakfast?" (the
       * widest phrase) so the window is permanently sized to the largest word.
       * This prevents any layout shift as the reel scrolls.
       */}
      <span
        aria-hidden="true"
        style={{
          display: "block",
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        for breakfast?
      </span>

      {/*
       * REEL STRIP — all words stacked as a single block column, positioned
       * absolutely over the ghost. Animating its y scrolls the entire strip
       * upward through the window like a physical slot-machine reel.
       *
       * At y=0:          "for breakfast?" is visible  (word 0)
       * At y=-slotH:     "for dinner?" is visible      (word 1)
       * At y=-(9*slotH): "tonight?" is visible         (word 9, final)
       */}
      <motion.span
        ref={reelScope}
        initial={{ y: 0 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "block",
        }}
      >
        {REEL.map((word, i) => (
          <span
            key={i}
            style={{
              display: "block",
              whiteSpace: "nowrap",
              lineHeight: "inherit",
            }}
          >
            {word}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
