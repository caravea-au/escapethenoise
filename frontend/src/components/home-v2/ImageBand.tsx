import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Parallax } from "@/components/ui/motion/Parallax";

// Cinematic full-bleed image moment — breaks the type-on-cream rhythm and adds the
// visual richness a premium editorial page needs. Parallax for depth, editorial caption.
export function ImageBand() {
  return (
    <section className="relative h-[58vh] min-h-[400px] overflow-hidden bg-green-dark md:h-[78vh]">
      <Parallax className="absolute inset-0" distance={50}>
        <Image
          src="/photos/edu-feat.webp"
          alt="A family setting up their caravan"
          fill
          sizes="100vw"
          className="scale-[1.3] object-cover object-[center_45%]"
          priority={false}
        />
      </Parallax>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,28,20,.15)_0%,rgba(16,28,20,.2)_55%,rgba(16,28,20,.65)_100%)]" />

      <Container className="absolute inset-x-0 bottom-0 pb-12 md:pb-16">
        <Reveal>
          <div className="flex items-end justify-between gap-6 border-t border-white/25 pt-6">
            <p className="max-w-[24ch] font-oswald text-[24px] font-bold uppercase leading-[1.05] tracking-[-0.3px] text-white sm:text-[34px] lg:text-[40px]">
              From the coast to the outback
              <span className="mt-1 block font-serif text-[22px] font-normal normal-case italic text-gold sm:text-[30px] lg:text-[34px]">
                your trip starts here.
              </span>
            </p>
            <span className="hidden shrink-0 text-[11px] uppercase tracking-[2.5px] text-white/70 sm:block">
              Fig. 01 — The open road
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
