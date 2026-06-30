import type { ReactNode } from "react";

const WIDTHS = {
  marketing: "max-w-[1280px]",
  education: "max-w-[1180px]",
  article: "max-w-[820px]",
} as const;

type Props = {
  children: ReactNode;
  className?: string;
  width?: keyof typeof WIDTHS;
};

// design.md §5 — centred content column with 24px gutters.
export function Container({ children, className = "", width = "marketing" }: Props) {
  return <div className={`${WIDTHS[width]} mx-auto px-6 ${className}`}>{children}</div>;
}
