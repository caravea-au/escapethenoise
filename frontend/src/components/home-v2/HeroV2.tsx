import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { MaskReveal } from "@/components/ui/motion/MaskReveal";

const METRICS = [
  { value: "403+", label: "Accredited dealers" },
  { value: "8", label: "States & territories" },
  { value: "60+", label: "Brands represented" },
  { value: "100%", label: "Industry accredited" },
];

// Editorial hero — meta row, oversized mask-revealed headline, restrained search, metric strip.
export function HeroV2() {
  return (
    <section className="relative overflow-hidden bg-cream pt-12 pb-20 md:pt-16 md:pb-28">
      <Container>
        <Reveal y={10}>
          <div className="flex items-center justify-between border-b border-line pb-5 text-[11px] font-semibold uppercase tracking-[2.5px] text-tag">
            <span>The official CIAA directory</span>
            <span className="hidden sm:inline">No better time to escape the noise</span>
            <span className="text-rust">© 2026</span>
          </div>
        </Reveal>

        <h1 className="mt-10 font-oswald text-[52px] font-bold uppercase leading-[0.88] tracking-[-1.5px] text-green sm:text-[78px] lg:text-[108px] xl:text-[126px]">
          <MaskReveal
            mode="load"
            lines={[
              "Find your nearest",
              <>
                <span className="text-rust">accredited</span> caravan
              </>,
              "dealer",
            ]}
          />
        </h1>

        <div className="mt-12 grid gap-8 md:grid-cols-[1.15fr_1fr] md:items-end">
          <Reveal delay={0.1}>
            <p className="max-w-[460px] text-[17px] leading-[1.65] text-ink/80">
              Australia&apos;s most trusted caravan resource — search 403+ accredited dealers,
              backed by every state and territory caravanning association.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="flex w-full items-center gap-2 rounded-input border border-[#d9cdb4] bg-white p-2 pl-5 shadow-[0_18px_50px_-30px_rgba(22,39,28,.4)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
                <path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" fill="#C17C2C" />
                <circle cx="12" cy="9" r="2.6" fill="#fff" />
              </svg>
              <input
                placeholder="Suburb or postcode"
                aria-label="Suburb or postcode"
                className="w-full border-0 bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-muted"
              />
              <Button href="#" className="shrink-0 px-6 py-3 text-sm">
                Find →
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.22}>
          <div className="mt-16 grid grid-cols-2 gap-y-8 border-t border-line pt-10 sm:grid-cols-4">
            {METRICS.map((m, i) => (
              <div key={m.label} className={i > 0 ? "sm:border-l sm:border-line sm:pl-8" : ""}>
                <div className="font-oswald text-[46px] font-bold leading-none tracking-[-1px] text-green lg:text-[62px]">
                  {m.value}
                </div>
                <div className="mt-3 text-[12px] font-semibold uppercase tracking-[1.5px] text-tag">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
