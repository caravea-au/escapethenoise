import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Eyebrow } from "@/components/ui/Eyebrow";

// Renders while the dealer list / counts are fetched. The page-head band is
// real (no data dependency), so it paints immediately; the map + result-card
// area below is skeleton-only.
export default function FindDealerLoading() {
  return (
    <>
      <section className="bg-[linear-gradient(150deg,var(--color-green),var(--color-green-dark))]">
        <Container width="marketing" className="pt-11 pb-10">
          <Eyebrow tone="gold">Dealer directory</Eyebrow>
          <Heading as="h1" className="mt-2.5 text-[28px] text-white md:text-[32px] lg:text-[42px]">
            Find a Dealer Near You
          </Heading>
          <Text variant="lead" className="mt-2 max-w-[620px] text-sand">
            Accredited caravan dealers across Australia. Search by location, brand or van type.
          </Text>
        </Container>
      </section>

      <Container width="marketing" className="py-10">
        <div className="flex flex-wrap items-start gap-6">
          <div
            className="h-[420px] flex-[1_1_540px] min-w-[300px] animate-pulse rounded-card bg-cream-deep motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="flex flex-[1_1_380px] min-w-[300px] flex-col gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[120px] animate-pulse rounded-card border border-line bg-white motion-reduce:animate-none"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
