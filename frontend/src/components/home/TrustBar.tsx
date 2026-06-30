import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";

const STATS = [
  { value: "403", plus: true, label: "Accredited Dealers" },
  { value: "8", plus: false, label: "States & Territories" },
  { value: "60", plus: true, label: "Brands Represented" },
];

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

function LogoTrack({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="flex items-center gap-[88px] px-11" aria-hidden={hidden || undefined}>
      {STATES.map((s, i) => (
        <Image
          key={`${s.src}-${i}`}
          src={s.src}
          alt={hidden ? "" : s.alt}
          width={140}
          height={104}
          className="block h-[104px] w-auto shrink-0 object-contain"
        />
      ))}
    </div>
  );
}

// Trust bar — stats + an infinite state-association logo marquee (design.md §8).
export function TrustBar() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(165deg,#1c3324_0%,#16271C_60%,#101f15_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_88%_8%,rgba(193,124,44,.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_6%_100%,rgba(229,192,121,.12),transparent_55%)]" />

      <Container className="relative pt-16 pb-[60px]">
        <div className="mx-auto max-w-[680px] text-center">
          <Eyebrow tone="gold" className="inline-flex items-center gap-[9px] tracking-[2.5px]">
            <span className="h-[7px] w-[7px] rounded-full bg-gold" />
            Trusted across Australia
          </Eyebrow>
          <Heading
            as="h2"
            className="mt-3.5 text-[28px] uppercase leading-[1.04] tracking-[-.5px] text-white md:text-[31px] lg:text-[41px] xl:text-[44px]"
          >
            The national standard in
            <br />
            accredited caravan dealers
          </Heading>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
          {STATS.map((s, i) => (
            <div key={s.label} className={`text-center ${i > 0 ? "border-l border-cream-deep/[.14]" : ""}`}>
              <div className="font-oswald text-[54px] font-bold leading-[.85] tracking-[-2px] text-cream-deep lg:text-[72px] xl:text-[82px]">
                {s.value}
                {s.plus && <span className="text-gold">+</span>}
              </div>
              <div className="mt-3.5 text-[13px] font-semibold uppercase tracking-[1px] text-[#bdb293]">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[58px] border-t border-cream-deep/[.14] pt-12">
          <div className="mx-auto mb-[30px] max-w-[560px] text-center">
            <Eyebrow tone="gold" className="tracking-[2.5px]">
              Backed by the industry
            </Eyebrow>
            <Heading
              as="h3"
              className="mt-2.5 text-[20px] font-semibold uppercase leading-[1.15] tracking-[.3px] text-white lg:text-[25px] xl:text-[27px]"
            >
              In partnership with Australia&apos;s state &amp; territory caravanning associations
            </Heading>
          </div>

          <div className="relative overflow-hidden rounded-[20px] bg-cream-deep py-[30px] shadow-[0_24px_56px_-26px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.5)]">
            <div className="flex w-max animate-marquee">
              <LogoTrack />
              <LogoTrack hidden />
            </div>
            <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-[90px] bg-[linear-gradient(to_right,#EFE7D2,rgba(239,231,210,0))]" />
            <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-[90px] bg-[linear-gradient(to_left,#EFE7D2,rgba(239,231,210,0))]" />
          </div>

          <div className="mt-[30px] flex flex-col items-center gap-4">
            <span className="text-[12.5px] font-medium tracking-[.2px] text-[#bdb293]">
              The official directory of
            </span>
            <Image
              src="/brand/ciaa-logo-rev.webp"
              alt="Caravan Industry Association of Australia"
              width={180}
              height={58}
              className="block h-[58px] w-auto"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
