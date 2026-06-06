"use client";

import { useRef } from "react";

/**
 * Returns onTouchStart / onTouchEnd handlers that call onClose()
 * when the user swipes down more than `threshold` pixels.
 * Spread onto the bottom-sheet div: <div {...swipe}>
 */
export function useSwipeToClose(onClose: () => void, threshold = 80) {
  const startY = useRef<number | null>(null);

  return {
    onTouchStart(e: React.TouchEvent) {
      startY.current = e.touches[0]?.clientY ?? null;
    },
    onTouchEnd(e: React.TouchEvent) {
      if (startY.current === null) return;
      const dy = (e.changedTouches[0]?.clientY ?? 0) - startY.current;
      startY.current = null;
      if (dy > threshold) onClose();
    },
  };
}
