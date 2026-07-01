import type { ComponentPropsWithoutRef, ReactNode } from "react";

// design.md §5 — alternate cream and dark-green bands for cadence; large
// vertical padding (64–116px) between major bands.
type Tone = "cream" | "green";

const tones: Record<Tone, string> = {
  cream: "bg-cream text-ink",
  green: "bg-green text-cream",
};

export function Section({
  tone = "cream",
  className = "",
  children,
  ...rest
}: { tone?: Tone; children: ReactNode } & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={`py-16 md:py-24 lg:py-[116px] ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}
