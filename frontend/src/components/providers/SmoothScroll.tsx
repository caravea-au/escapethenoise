"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Lenis smooth-scroll momentum (the "premium feel") + global Motion config.
// reducedMotion="user" makes every Reveal honour prefers-reduced-motion automatically:
// content still appears, but the movement is dropped — no per-component branching needed.
export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
        {children}
      </ReactLenis>
    </MotionConfig>
  );
}
