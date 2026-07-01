"use client";

import { motion, useReducedMotion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** stagger delay in seconds */
  delay?: number;
  /** vertical offset to rise from, px */
  y?: number;
  className?: string;
  once?: boolean;
};

// Scroll-reveal wrapper (Motion) — robust + reduced-motion aware.
// The trigger watches THIS element's own ref via useInView (a single, stable, block-level
// motion.div), which fires reliably on any scroll — unlike `whileInView`, which gets
// skipped on fast/jumpy scroll and was leaving sections blank. A failsafe timer also
// reveals the content if the observer never fires, so it can never stay hidden.
// Reduced-motion users get the content immediately, statically.
export function Reveal({ children, delay = 0, y = 24, className, once = true }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount: 0.15 });
  const [failsafe, setFailsafe] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFailsafe(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const show = reduce || inView || failsafe;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : y }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
