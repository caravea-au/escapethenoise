import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { VehicleListingCard } from "@/components/VehicleListingCard/VehicleListingCard";
import { getVehicleListings } from "@/lib/strapi";

// Reusable RV finder quiz (Typeform). Same URL on both CTAs.
const SURVEY_URL =
  "https://letsgocaravan.typeform.com/to/LEDXVhmR?utm_source=letsgowebsite&utm_medium=vehiclequizpg&utm_campaign=caravanbuyersservice";

export const metadata: Metadata = {
  title: "Find Your Vehicle — RV Finder",
  description:
    "A free, easy-to-use service that connects you with trusted local RV dealers. Compare camper trailers, camper vans, motorhomes, caravans and more.",
};

export default async function VehicleListingsPage() {
  const vehicles = await getVehicleListings();

  return (
    <>
      <section className="bg-[linear-gradient(165deg,var(--color-green-mid),var(--color-green-dark))]">
        <Container width="education" className="pt-[54px] pb-[50px]">
          <Eyebrow tone="gold">Find your vehicle</Eyebrow>
          <Heading
            as="h1"
            className="mt-2.5 max-w-[820px] text-[30px] tracking-[-1px] text-white md:text-[40px] lg:text-[48px]"
          >
            RV Finder connects you with trusted local RV dealers
          </Heading>
          <Text variant="lead" className="mt-2.5 max-w-[640px] text-sand">
            From the wonders of the Great Ocean Road to the adventurous Carnarvon Gorge, make sure
            you know which vehicle can take you there. With room for all the happy campers, big and
            small, let us help you find a personalised experience.
          </Text>
          <div className="mt-7">
            <Button
              variant="primary"
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Not sure? Take the quiz
            </Button>
          </div>
        </Container>
      </section>

      <Container width="education" className="pt-10 pb-16">
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <VehicleListingCard key={v.id} vehicle={v} />
            ))}
          </div>
        ) : (
          <Text variant="lead" className="text-muted">
            Vehicle types are on their way — check back soon.
          </Text>
        )}
      </Container>

      {/* Repeated quiz CTA band */}
      <section className="bg-cream">
        <Container width="education" className="py-14 text-center">
          <Heading as="h2" className="text-[26px] text-green md:text-[32px]">
            Still deciding which RV is right for you?
          </Heading>
          <Text variant="lead" className="mx-auto mt-2.5 max-w-[560px] text-tag">
            Answer a few quick questions and we&apos;ll point you to the vehicles — and dealers —
            that fit how you travel.
          </Text>
          <div className="mt-6 flex justify-center">
            <Button
              variant="primary"
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Not sure? Take the quiz
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
