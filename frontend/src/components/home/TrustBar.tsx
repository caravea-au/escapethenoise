import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { strapiMedia, type HomeTrustBar } from "@/lib/strapi";

// Fallbacks — the current hardcoded trust-bar content, used when Strapi has no value.
const FALLBACK_EYEBROW = "Trusted across Australia";
const FALLBACK_HEADING = "The national standard in\naccredited caravan dealers";
const FALLBACK_PARTNERS_EYEBROW = "Backed by the industry";
const FALLBACK_PARTNERS_HEADING =
  "In partnership with Australia's state & territory caravanning associations";
const FALLBACK_CIAA_LABEL = "The official directory of";
const FALLBACK_CIAA_LOGO = "/brand/ciaa-logo-rev.webp";

const FALLBACK_STATS = [
  { value: "403", showPlus: true, label: "Accredited Dealers" },
  { value: "8", showPlus: false, label: "States & Territories" },
  { value: "60", showPlus: true, label: "Brands Represented" },
];

const FALLBACK_STATES = [
  { src: "/brand/states/state-qld.webp", alt: "Caravanning Queensland" },
  { src: "/brand/states/state-nsw.webp", alt: "Caravan & Camping Industry Association NSW" },
  { src: "/brand/states/state-vic.webp", alt: "Caravan Industry Victoria" },
  { src: "/brand/states/state-sa.webp", alt: "Caravan & Camping SA" },
  { src: "/brand/states/state-wa.webp", alt: "Caravan & Camping Western Australia" },
];

type LogoItem = { src: string; alt: string };

function LogoTrack({ logos, hidden = false }: { logos: LogoItem[]; hidden?: boolean }) {
  return (
    <div className="flex items-center gap-[88px] px-11" aria-hidden={hidden || undefined}>
      {logos.map((s, i) => (
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
export function TrustBar({ data }: { data?: HomeTrustBar }) {
  const eyebrow = data?.eyebrow ?? FALLBACK_EYEBROW;
  const heading = data?.heading ?? FALLBACK_HEADING;
  const partnersEyebrow = data?.partnersEyebrow ?? FALLBACK_PARTNERS_EYEBROW;
  const partnersHeading = data?.partnersHeading ?? FALLBACK_PARTNERS_HEADING;
  const ciaaLabel = data?.ciaaLabel ?? FALLBACK_CIAA_LABEL;
  const ciaaLogo = strapiMedia(data?.ciaaLogo?.url) ?? FALLBACK_CIAA_LOGO;
  const stats = data?.stats?.length ? data.stats : FALLBACK_STATS;

  const logos: LogoItem[] =
    data?.stateLogos?.length
      ? data.stateLogos
          .map((l) => ({ src: strapiMedia(l.image?.url) ?? "", alt: l.alt ?? "" }))
          .filter((l) => l.src)
      : FALLBACK_STATES;

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(165deg,#1c3324_0%,#16271C_60%,#101f15_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_88%_8%,rgba(193,124,44,.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_6%_100%,rgba(229,192,121,.12),transparent_55%)]" />

      <Container className="relative pt-16 pb-[60px]">
        <div className="mx-auto max-w-[680px] text-center">
          <Eyebrow tone="gold" className="inline-flex items-center gap-[9px] tracking-[2.5px]">
            <span className="h-[7px] w-[7px] rounded-full bg-gold" />
            {eyebrow}
          </Eyebrow>
          <Heading
            as="h2"
            className="mt-3.5 whitespace-pre-line text-[28px] uppercase leading-[1.04] tracking-[-.5px] text-white md:text-[31px] lg:text-[41px] xl:text-[44px]"
          >
            {heading}
          </Heading>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
          {stats.map((s, i) => (
            <div key={s.label ?? i} className={`text-center ${i > 0 ? "border-l border-cream-deep/[.14]" : ""}`}>
              <div className="font-oswald text-[54px] font-bold leading-[.85] tracking-[-2px] text-cream-deep lg:text-[72px] xl:text-[82px]">
                {s.value}
                {s.showPlus && <span className="text-gold">+</span>}
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
              {partnersEyebrow}
            </Eyebrow>
            <Heading
              as="h3"
              className="mt-2.5 text-[20px] font-semibold uppercase leading-[1.15] tracking-[.3px] text-white lg:text-[25px] xl:text-[27px]"
            >
              {partnersHeading}
            </Heading>
          </div>

          <div className="relative overflow-hidden rounded-[20px] bg-cream-deep py-[30px] shadow-[0_24px_56px_-26px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.5)]">
            <div className="flex w-max animate-marquee">
              <LogoTrack logos={logos} />
              <LogoTrack logos={logos} hidden />
            </div>
            <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-[90px] bg-[linear-gradient(to_right,#EFE7D2,rgba(239,231,210,0))]" />
            <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-[90px] bg-[linear-gradient(to_left,#EFE7D2,rgba(239,231,210,0))]" />
          </div>

          <div className="mt-[30px] flex flex-col items-center gap-4">
            <span className="text-[12.5px] font-medium tracking-[.2px] text-[#bdb293]">
              {ciaaLabel}
            </span>
            <Image
              src={ciaaLogo}
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
