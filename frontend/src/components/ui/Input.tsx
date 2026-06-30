import type { ComponentPropsWithoutRef } from "react";

// design.md §6 — cream/white fill, line border, radius 9–14px; focus ring 2px rust
// (the rust focus ring is applied globally in globals.css).
export function Input({
  className = "",
  ...rest
}: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={`w-full rounded-input border border-line bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted ${className}`}
      {...rest}
    />
  );
}
