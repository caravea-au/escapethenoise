// Statically imported graceful-degradation skin for the dealer map — MUST NOT
// import mapbox-gl (or anything that does), so it never pulls the ~230KB
// mapbox chunk. Reused for the pre-intersection "loading" state, a missing
// token, and a runtime map failure — the dealer list must keep working in
// every case. Decorative illustration ported from the design export
// (find-a-dealer-directory, "MAP" block) using theme tokens, not raw hexes.

type Variant = "loading" | "unavailable" | "error";

const CAPTION: Record<Variant, string> = {
  loading: "Loading map…",
  unavailable: "Map unavailable — browse the dealer list below.",
  error: "The map couldn't load — browse the dealer list below.",
};

type Props = {
  variant: Variant;
  /**
   * Overrides the caption. The defaults above point at the dealer list, which
   * is right on /find-dealer and wrong everywhere else — the onboarding form
   * reuses this skin and needs to talk about the address fields instead.
   */
  caption?: string;
};

export function MapFallback({ variant, caption }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-card border border-line-strong bg-map-land">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-cream-deep),var(--color-map-land))]" />
      <div className="absolute left-[-5%] top-[-10%] h-[60%] w-[55%] rounded-[48%_52%_60%_40%/55%_45%_60%_40%] bg-map-scrub opacity-70" />
      <div className="absolute right-[-8%] bottom-[-12%] h-[55%] w-1/2 rounded-[50%_50%_42%_58%/48%_52%_50%_50%] bg-map-sand opacity-70" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.5)_0_1px,transparent_1px_70px),repeating-linear-gradient(90deg,rgba(255,255,255,.5)_0_1px,transparent_1px_70px)]" />
      <div className="absolute left-0 top-[42%] h-[7px] w-full -rotate-[7deg] bg-white/60" />
      <div className="absolute left-[38%] top-0 h-full w-[7px] rotate-[5deg] bg-white/60" />
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <p
          role="status"
          className="rounded-input border border-line-strong bg-white/90 px-4 py-2 text-[13px] font-medium text-green shadow-[0_4px_14px_rgba(22,39,28,.15)]"
        >
          {caption ?? CAPTION[variant]}
        </p>
      </div>
    </div>
  );
}
