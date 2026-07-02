import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { VehicleListingCard } from "@/components/VehicleListingCard/VehicleListingCard";
import { getVehicleListings, getVehicleListingsPage, strapiMedia } from "@/lib/strapi";

// Fallback copy — used verbatim when the Strapi single type is empty or unreachable,
// so the page renders identically without the CMS. Strapi values override per-field.
const FALLBACK = {
  metaTitle: "Find Your Vehicle — RV Finder",
  metaDescription:
    "A free, easy-to-use service that connects you with trusted local RV dealers. Compare camper trailers, camper vans, motorhomes, caravans and more.",
  heroEyebrow: "Find your vehicle",
  heroHeading: "RV Finder connects you with trusted local RV dealers",
  heroLead:
    "From the wonders of the Great Ocean Road to the adventurous Carnarvon Gorge, make sure you know which vehicle can take you there. With room for all the happy campers, big and small, let us help you find a personalised experience.",
  // Reusable RV finder quiz (Typeform). Same URL on both CTAs.
  surveyUrl:
    "https://letsgocaravan.typeform.com/to/LEDXVhmR?utm_source=letsgowebsite&utm_medium=vehiclequizpg&utm_campaign=caravanbuyersservice",
  quizButtonLabel: "Not sure? Take the quiz",
  emptyStateText: "Vehicle types are on their way — check back soon.",
  ctaHeading: "Still deciding which RV is right for you?",
  ctaLead:
    "Answer a few quick questions and we'll point you to the vehicles — and dealers — that fit how you travel.",
  ctaButtonLabel: "Not sure? Take the quiz",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getVehicleListingsPage();
  const title = page?.seo?.metaTitle ?? FALLBACK.metaTitle;
  const description = page?.seo?.metaDescription ?? FALLBACK.metaDescription;
  // ogImage from Strapi if set, else the site default from the root layout.
  const ogImage = strapiMedia(page?.seo?.ogImage?.url) ?? "/og-image.png";

  return {
    title,
    description,
    alternates: { canonical: "/vehicle-listings" },
    openGraph: {
      title,
      description,
      url: "/vehicle-listings",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function VehicleListingsPage() {
  const [vehicles, page] = await Promise.all([getVehicleListings(), getVehicleListingsPage()]);

  const surveyUrl = page?.surveyUrl ?? FALLBACK.surveyUrl;
  const quizButtonLabel = page?.quizButtonLabel ?? FALLBACK.quizButtonLabel;

  return (
    <>
      <section className="bg-[linear-gradient(165deg,var(--color-green-mid),var(--color-green-dark))]">
        <Container width="education" className="pt-[54px] pb-[50px]">
          <Eyebrow tone="gold">{page?.heroEyebrow ?? FALLBACK.heroEyebrow}</Eyebrow>
          <Heading
            as="h1"
            className="mt-2.5 max-w-[820px] text-[30px] tracking-[-1px] text-white md:text-[40px] lg:text-[48px]"
          >
            {page?.heroHeading ?? FALLBACK.heroHeading}
          </Heading>
          <Text variant="lead" className="mt-2.5 max-w-[640px] text-sand">
            {page?.heroLead ?? FALLBACK.heroLead}
          </Text>
          <div className="mt-7">
            <Button variant="primary" href={surveyUrl} target="_blank" rel="noopener noreferrer">
              {quizButtonLabel}
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
            {page?.emptyStateText ?? FALLBACK.emptyStateText}
          </Text>
        )}
      </Container>

      {/* Repeated quiz CTA band */}
      <section className="bg-cream">
        <Container width="education" className="py-14 text-center">
          <Heading as="h2" className="text-[26px] text-green md:text-[32px]">
            {page?.ctaHeading ?? FALLBACK.ctaHeading}
          </Heading>
          <Text variant="lead" className="mx-auto mt-2.5 max-w-[560px] text-tag">
            {page?.ctaLead ?? FALLBACK.ctaLead}
          </Text>
          <div className="mt-6 flex justify-center">
            <Button variant="primary" href={surveyUrl} target="_blank" rel="noopener noreferrer">
              {page?.ctaButtonLabel ?? FALLBACK.ctaButtonLabel}
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
