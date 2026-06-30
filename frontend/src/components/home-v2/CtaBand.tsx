import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { MaskReveal } from "@/components/ui/motion/MaskReveal";
import { Parallax } from "@/components/ui/motion/Parallax";

// Full-bleed closing CTA — parallax photo under a green scrim, oversized mask headline.
export function CtaBand() {
  return (
    <section className="relative flex min-h-[520px] items-center overflow-hidden bg-green-dark md:min-h-[640px]">
      <Parallax className="absolute inset-0" distance={50}>
        <Image
          src="/photos/road-calling.webp"
          alt=""
          fill
          sizes="100vw"
          className="scale-[1.3] object-cover object-[center_55%]"
        />
      </Parallax>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,28,20,.5)_0%,rgba(16,28,20,.82)_100%)]" />

      <Container className="relative w-full py-24">
        <Reveal y={12}>
          <span className="text-[12px] font-semibold uppercase tracking-[3px] text-gold">
            No better time to escape the noise
          </span>
        </Reveal>

        <h2 className="mt-6 max-w-[15ch] font-oswald text-[44px] font-bold uppercase leading-[0.92] tracking-[-1px] text-white sm:text-[68px] lg:text-[92px]">
          <MaskReveal lines={["The open road", "is calling"]} />
        </h2>

        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Button href="#" className="px-8 py-4 text-base">
              Find your nearest dealer →
            </Button>
            <span className="text-[14px] text-sand">
              403+ accredited dealers · every state &amp; territory
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
