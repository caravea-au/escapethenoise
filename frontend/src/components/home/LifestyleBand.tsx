import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";

// Full-bleed lifestyle band — photo under a left-to-right green scrim (design.md §7).
export function LifestyleBand() {
  return (
    <section className="relative flex min-h-[380px] items-center overflow-hidden md:min-h-[400px] lg:min-h-[520px] xl:min-h-[540px]">
      <Image
        src="/photos/road-calling.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[center_55%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,28,20,.82)_0%,rgba(16,28,20,.55)_48%,rgba(16,28,20,.25)_100%)]" />
      <Container className="relative w-full py-16">
        <div className="max-w-[560px]">
          <Eyebrow tone="gold" className="tracking-[3px]">
            No better time to escape the noise
          </Eyebrow>
          <Heading
            as="h2"
            className="mt-3.5 text-[30px] uppercase leading-[1.02] tracking-[-.5px] text-white md:text-[35px] lg:text-[47px] xl:text-[52px]"
          >
            The open road is calling
          </Heading>
          <p className="mt-4 text-[15px] leading-[1.55] text-[#d8cfb8] lg:text-[18px]">
            From coastal parks to outback skies, every great trip starts with the right van — and the
            right accredited dealer to set you up. Find yours and go.
          </p>
          <Button href="#" className="mt-[26px] px-[30px] py-[15px]">
            Find your nearest dealer →
          </Button>
        </div>
      </Container>
    </section>
  );
}
