import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { MaskReveal } from "@/components/ui/motion/MaskReveal";
import { Parallax } from "@/components/ui/motion/Parallax";

const METRICS = [
  { value: "403+", label: "Accredited dealers" },
  { value: "8", label: "States & territories" },
  { value: "60+", label: "Brands represented" },
  { value: "100%", label: "Industry accredited" },
];

// Editorial hero on a cinematic parallax video — dark-green scrim keeps the oversized
// mask-revealed headline, intro, search and metric strip fully readable.
export function HeroV2() {
  return (
    <section className="relative overflow-hidden bg-green-dark pt-28 pb-16 md:pt-32 md:pb-20">
      {/* parallax video background */}
      <Parallax className="absolute inset-0 z-0" distance={70}>
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/photos/hero.webp"
          className="h-full w-full scale-[1.2] object-cover"
        >
          <source src="/photos/hero.mp4" type="video/mp4" />
        </video>
      </Parallax>
      {/* legibility scrims: overall darken + heavier bottom + soft top vignette */}
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(178deg,rgba(16,28,20,.72)_0%,rgba(22,39,28,.5)_42%,rgba(16,28,20,.86)_100%)]" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(120%_80%_at_50%_0%,transparent_30%,rgba(16,28,20,.5)_100%)]" />

      <Container className="relative z-[2]">
        <Reveal y={10}>
          <div className="flex items-center justify-between border-b border-white/20 pb-5 text-[11px] font-semibold uppercase tracking-[2.5px] text-sand">
            <span>The official CIAA directory</span>
            <span className="hidden sm:inline text-white/70">No better time to escape the noise</span>
            <span className="text-gold">© 2026</span>
          </div>
        </Reveal>

        <h1 className="mt-10 font-oswald text-[52px] font-bold uppercase leading-[0.88] tracking-[-1.5px] text-white drop-shadow-[0_2px_30px_rgba(0,0,0,0.45)] sm:text-[78px] lg:text-[104px] xl:text-[122px]">
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
            <p className="max-w-[460px] text-[17px] leading-[1.65] text-sand">
              Australia&apos;s <span className="font-serif text-[18px] italic text-white">most trusted</span>{" "}
              caravan resource — search 403+ accredited dealers, backed by every state and
              territory caravanning association.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="flex w-full items-center gap-2 rounded-input border border-white/15 bg-white p-2 pl-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,.7)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
                <path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" fill="#C17C2C" />
                <circle cx="12" cy="9" r="2.6" fill="#fff" />
              </svg>
              <input
                placeholder="Suburb or postcode"
                aria-label="Suburb or postcode"
                className="w-full min-w-0 border-0 bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-muted"
              />
              <Button href="#" className="shrink-0 px-5 py-3 text-sm">
                Find →
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.22}>
          <div className="mt-14 grid grid-cols-2 gap-y-8 border-t border-white/20 pt-9 sm:grid-cols-4">
            {METRICS.map((m, i) => (
              <div key={m.label} className={i > 0 ? "sm:border-l sm:border-white/20 sm:pl-8" : ""}>
                <div className="font-oswald text-[44px] font-bold leading-none tracking-[-1px] text-cream lg:text-[58px]">
                  {m.value}
                </div>
                <div className="mt-3 text-[12px] font-semibold uppercase tracking-[1.5px] text-sand/80">
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
