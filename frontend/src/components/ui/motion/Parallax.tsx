"use client";

import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** total travel in px across the element's scroll pass */
  distance?: number;
};

// Subtle scroll parallax for imagery — the child drifts as the section passes the
// viewport, adding depth without motion-sickness. Reduced-motion users (and the no-JS
// path) get a static child. Wrap an over-sized image so edges never show.
export function Parallax({ children, className, distance = 70 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }} className="h-full w-full will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
