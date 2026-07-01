import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
// import { Button } from "@/components/ui/Button";
import { strapiMedia, type HomeLifestyle } from "@/lib/strapi";

// Fallbacks — the current hardcoded lifestyle-band content, used when Strapi has no value.
const FALLBACK_IMAGE = "/photos/road-calling.webp";
const FALLBACK_EYEBROW = "No better time to escape the noise";
const FALLBACK_HEADING = "The open road is calling";
const FALLBACK_BODY =
  "From coastal parks to outback skies, every great trip starts with the right van — and the right accredited dealer to set you up. Find yours and go.";

// Full-bleed lifestyle band — photo under a left-to-right green scrim (design.md §7).
export function LifestyleBand({ data }: { data?: HomeLifestyle }) {
  const image = strapiMedia(data?.backgroundImage?.url) ?? FALLBACK_IMAGE;
  const eyebrow = data?.eyebrow ?? FALLBACK_EYEBROW;
  const heading = data?.heading ?? FALLBACK_HEADING;
  const body = data?.body ?? FALLBACK_BODY;

  return (
    <section className="relative flex min-h-[380px] items-center overflow-hidden md:min-h-[400px] lg:min-h-[520px] xl:min-h-[540px]">
      <Image
        src={image}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[center_55%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,28,20,.82)_0%,rgba(16,28,20,.55)_48%,rgba(16,28,20,.25)_100%)]" />
      <Container className="relative w-full py-16">
        <div className="max-w-[560px]">
          <Eyebrow tone="gold" className="tracking-[3px]">
            {eyebrow}
          </Eyebrow>
          <Heading
            as="h2"
            className="mt-3.5 text-[30px] uppercase leading-[1.02] tracking-[-.5px] text-white md:text-[35px] lg:text-[47px] xl:text-[52px]"
          >
            {heading}
          </Heading>
          <p className="mt-4 text-[15px] leading-[1.55] text-[#d8cfb8] lg:text-[18px]">
            {body}
          </p>
          {/* <Button href="#" className="mt-[26px] px-[30px] py-[15px]">
            Find your nearest dealer →
          </Button> */}
        </div>
      </Container>
    </section>
  );
}
