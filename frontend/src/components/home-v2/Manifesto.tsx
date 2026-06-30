import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { MaskReveal } from "@/components/ui/motion/MaskReveal";

// /01/ — editorial statement on a dark-green band. Mask-revealed claim, lots of air.
export function Manifesto() {
  return (
    <section className="bg-green py-24 text-cream md:py-36">
      <Container>
        <Reveal y={12}>
          <span className="text-[12px] font-semibold uppercase tracking-[3px] text-gold">
            / 01 / Why accreditation
          </span>
        </Reveal>

        <h2 className="mt-10 max-w-[18ch] font-oswald text-[38px] font-bold uppercase leading-[1.0] tracking-[-0.5px] text-white sm:text-[56px] lg:text-[74px]">
          <MaskReveal
            lines={["Buy from a dealer", <>the industry</>, "stands behind."]}
          />
        </h2>

        <div className="mt-12 grid gap-10 border-t border-white/15 pt-10 md:grid-cols-[1fr_1.2fr]">
          <Reveal delay={0.06}>
            <p className="text-[15px] uppercase leading-[1.6] tracking-[1px] text-gold">
              A national benchmark,
              <br />
              not a sales pitch.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-[560px] text-[17px] leading-[1.75] text-sand">
              Every dealer in this directory meets the Caravan Industry Association of
              Australia&apos;s accreditation standard — independently upheld and backed by your
              state and territory association. You start your journey with people held to a
              standard, so the only thing left to choose is where the road goes next.
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
