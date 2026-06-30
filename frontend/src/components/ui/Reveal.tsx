"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** stagger delay in seconds */
  delay?: number;
  /** vertical offset to rise from, px */
  y?: number;
  className?: string;
  once?: boolean;
};

// Scroll-reveal wrapper (Motion) — FAIL-SAFE by design.
// The server and the first client render emit a plain, fully-visible <div>, so:
//   • hydration always matches (no mismatch error), and
//   • if the client JS never runs (broken HMR, blocked bundle, no-JS), the content is
//     still VISIBLE — it degrades to static, never to a blank section.
// Only after a successful mount do we upgrade to the animated motion.div. Reduced-motion
// users keep the static, visible version. Animates transform/opacity only.
export function Reveal({ children, delay = 0, y = 24, className, once = true }: Props) {
  const [animate, setAnimate] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!reduce) setAnimate(true);
  }, [reduce]);

  if (!animate) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
