import type { ComponentPropsWithoutRef } from "react";

// design.md §6 — cream/white fill, line border, radius 9–14px; focus ring 2px rust
// (the rust focus ring is applied globally in globals.css).
// `tone` defaults to "cream" (existing onboarding-form surface); "white" is for
// fields sitting on a white surface (dealer directory filter bar / modal).
export function Input({
  tone = "cream",
  className = "",
  ...rest
}: ComponentPropsWithoutRef<"input"> & { tone?: "cream" | "white" }) {
  const surface =
    tone === "white" ? "bg-white border-line-strong" : "bg-cream border-line";
  return (
    <input
      className={`w-full rounded-input border ${surface} px-4 py-3 text-[15px] text-ink placeholder:text-muted ${className}`}
      {...rest}
    />
  );
}
