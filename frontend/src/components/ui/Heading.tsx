import type { ElementType, ReactNode } from "react";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
};

// design.md §3 — Oswald display heading. Pass `as` for the right semantic level
// (h1/h2/h3) and size/colour via className (Tailwind breakpoint steps, no clamp).
export function Heading({ children, as: Tag = "h2", className = "" }: Props) {
  return <Tag className={`font-oswald font-bold ${className}`}>{children}</Tag>;
}
