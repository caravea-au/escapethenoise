import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { FeaturedGuideCard } from "@/components/FeaturedGuideCard/FeaturedGuideCard";
import { BuyingGuidesExplorer } from "@/components/BuyingGuidesExplorer/BuyingGuidesExplorer";
import { getBuyingGuides } from "@/lib/strapi";

export const metadata: Metadata = {
  title: "Buying Guides & Caravan Advice",
  description:
    "Independent, jargon-free guidance from the Caravan Industry Association — so you buy with confidence.",
};

export default async function BuyingGuidesPage() {
  const guides = await getBuyingGuides();
  const featured = guides.find((g) => g.featured) ?? null;
  const gridGuides = guides.filter((g) => !g.featured);

  return (
    <>
      <section className="bg-[linear-gradient(165deg,var(--color-green-mid),var(--color-green-dark))]">
        <Container width="content" className="pt-[54px] pb-[50px]">
          <Text as="div" variant="eyebrow" className="font-bold tracking-[3px] text-gold">
            Education
          </Text>
          <Heading as="h1" size="page" className="mt-2.5 text-white">
            Buying Guides &amp; Caravan Advice
          </Heading>
          <Text variant="lead" className="mt-2.5 max-w-[600px] text-sand">
            Independent, jargon-free guidance from the Caravan Industry Association — so you buy
            with confidence.
          </Text>
        </Container>
      </section>

      <Container width="content" className="pt-8 pb-24">
        {featured && <FeaturedGuideCard guide={featured} />}
        <BuyingGuidesExplorer guides={gridGuides} />
      </Container>
    </>
  );
}
