import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Marquee } from "@/components/ui/motion/Marquee";

const STATES = [
  { src: "/brand/states/state-qld.webp", alt: "Caravanning Queensland" },
  { src: "/brand/states/state-nsw.webp", alt: "Caravan & Camping Industry Association NSW" },
  { src: "/brand/states/state-vic.webp", alt: "Caravan Industry Victoria" },
  { src: "/brand/states/state-crpv.webp", alt: "Caravan & Residential Parks Victoria" },
  { src: "/brand/states/state-sa.webp", alt: "Caravan & Camping SA" },
  { src: "/brand/states/state-saparks.webp", alt: "SA Parks" },
  { src: "/brand/states/state-wa.webp", alt: "Caravan & Camping Western Australia" },
  { src: "/brand/states/state-nt.webp", alt: "Caravanning NT" },
  { src: "/brand/states/state-tas.webp", alt: "Caravanning Tasmania" },
];

// Backed-by-industry strip — state & territory association logos on an infinite,
// hover-pausing marquee, with edge fades for a polished, premium feel.
export function PartnerMarquee() {
  return (
    <section className="border-y border-line bg-cream-deep/40 py-16 md:py-20">
      <Container>
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[3px] text-tag">
              Backed by the industry
            </span>
            <span className="hidden text-[13px] text-muted sm:block">
              In partnership with every state &amp; territory association
            </span>
          </div>
        </Reveal>
      </Container>

      <Reveal delay={0.05}>
        <div className="relative mt-10">
          <Marquee>
            {STATES.map((s) => (
              <Image
                key={s.src}
                src={s.src}
                alt={s.alt}
                width={140}
                height={80}
                className="mx-7 h-14 w-auto object-contain opacity-75 transition-opacity duration-300 hover:opacity-100 md:mx-10 md:h-[68px]"
              />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[linear-gradient(to_right,var(--color-cream),transparent)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-[linear-gradient(to_left,var(--color-cream),transparent)]" />
        </div>
      </Reveal>
    </section>
  );
}
