import type { ReactNode } from "react";

const TONES = {
  rust: "text-rust",
  gold: "text-gold",
} as const;

type Props = {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
};

// design.md §3 — uppercase tracked label that sits above a heading.
export function Eyebrow({ children, className = "", tone = "rust" }: Props) {
  return (
    <span
      className={`block text-xs font-bold uppercase tracking-[2.5px] ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
