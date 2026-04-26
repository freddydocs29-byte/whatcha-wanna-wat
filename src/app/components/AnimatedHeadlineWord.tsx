"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SEQUENCE = [
  "for breakfast?",
  "for lunch?",
  "for dinner?",
  "for breakfast?",
  "for lunch?",
  "for dinner?",
  "for breakfast?",
  "for lunch?",
  "for dinner?",
  "tonight?",
] as const;

// Cumulative ms at which each phrase in SEQUENCE appears.
// Fast bursts first, then decelerates to land on "tonight".
const DELAYS = [0, 75, 150, 225, 300, 375, 450, 565, 700, 880];

const FINAL_INDEX = SEQUENCE.length - 1;

export function AnimatedHeadlineWord() {
  const [index, setIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Schedule each step (skip 0 — it's the initial render)
    DELAYS.slice(1).forEach((delay, i) => {
      const t = setTimeout(() => setIndex(i + 1), delay);
      timers.current.push(t);
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const phrase = SEQUENCE[index];
  const isFinal = index === FINAL_INDEX;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        overflow: "hidden",
        // baseline aligns with the surrounding "?" character
        verticalAlign: "baseline",
      }}
    >
      {/*
       * Invisible ghost element — always renders "for breakfast" (the widest phrase)
       * to lock the container to a fixed width/height. The "?" outside this
       * component stays stable regardless of which phrase is animating inside.
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
       * Animated phrase — position:absolute so it sits on top of the ghost
       * without affecting the container's size.
       */}
      <AnimatePresence initial={false}>
        <motion.span
          key={index}
          initial={{ y: "105%" }}
          animate={{ y: 0 }}
          exit={{ y: "-105%", transition: { duration: 0.1, ease: "easeInOut" } }}
          transition={{
            duration: isFinal ? 0.22 : 0.1,
            ease: isFinal ? [0.25, 1, 0.5, 1] : "easeInOut",
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "block",
            whiteSpace: "nowrap",
          }}
        >
          {phrase}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
