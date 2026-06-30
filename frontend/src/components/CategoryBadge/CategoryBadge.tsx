import type { ReactNode } from "react";

// Category pill. `card` = rust on cream (on light card surfaces);
// `hero` = green on gold (on the dark article hero). design.md §6.
type Tone = "card" | "hero";

const tones: Record<Tone, string> = {
  card: "text-rust bg-badge-accredited-bg",
  hero: "text-green bg-gold",
};

export function CategoryBadge({
  tone = "card",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block self-start rounded-[20px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[1px] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
