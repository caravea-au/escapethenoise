"use client";

import { motion, useReducedMotion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** each entry is one rendered line (string or JSX, e.g. with an accent <span>) */
  lines: ReactNode[];
  className?: string;
  lineClassName?: string;
  delay?: number;
  /** "load" plays on mount (above-the-fold heroes); "view" plays on scroll-into-view */
  mode?: "load" | "view";
};

// Signature headline motion — each line rises from behind a clip mask with a soft
// expo-out ease and a small per-line stagger.
// Robust + FAIL-SAFE:
//   • the ref-bearing wrapper is rendered on EVERY pass (server, pre-mount, post-mount),
//     so useInView observes a real, stable, block-level element from the first frame and
//     fires reliably on scroll;
//   • before mount (and for reduced-motion) the lines are plain and fully visible, so
//     content is never hidden if JS doesn't run, and hydration always matches.
export function MaskReveal({ lines, className, lineClassName, delay = 0, mode = "view" }: Props) {
  const [mounted, setMounted] = useState(false);
  const [failsafe, setFailsafe] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!reduce) setMounted(true);
  }, [reduce]);

  // never let a heading stay clipped if the observer somehow doesn't fire
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setFailsafe(true), 2500);
    return () => clearTimeout(t);
  }, [mounted]);

  const show = mode === "load" || inView || failsafe;

  return (
    <span ref={ref} className={`block ${className ?? ""}`}>
      {lines.map((line, i) =>
        !mounted ? (
          <span key={i} className={`block ${lineClassName ?? ""}`}>
            {line}
          </span>
        ) : (
          <span key={i} className="block overflow-hidden pb-[0.08em]">
            <motion.span
              className={`block ${lineClassName ?? ""}`}
              initial={{ y: "110%" }}
              animate={{ y: show ? "0%" : "110%" }}
              transition={{ duration: 0.85, delay: delay + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
            >
              {line}
            </motion.span>
          </span>
        )
      )}
    </span>
  );
}
