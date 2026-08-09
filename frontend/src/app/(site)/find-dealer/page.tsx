import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

const STATE_ASSOCIATIONS = [
  "Caravanning Queensland",
  "Caravan & Camping Industry Association NSW",
  "Caravan Industry Victoria",
  "Caravan & Residential Parks Victoria",
  "Caravan & Camping SA",
  "SA Parks",
  "Caravan & Camping Western Australia",
  "Caravanning NT",
  "Caravanning Tasmania",
];

export const metadata: Metadata = {
  title: "Find a Caravan Dealer",
  description:
    "The accredited caravan dealer directory is on its way. Soon you will be able to search dealers across Australia by suburb, postcode or state right here.",
  // Temporary: this is a thin placeholder page that echoes an arbitrary `?q=`
  // value, exactly the shape that generates parameterised index spam. Remove
  // this override once the real directory (map, filters, results) ships.
  robots: { index: false, follow: true },
};

export default async function FindDealerPage({
  searchParams,
}: {
  // Next 16 hands searchParams over as a Promise, and a repeated key
  // (/find-dealer?q=a&q=b) arrives as string[] — typing it as `string` would
  // throw on .trim() and 500 a public route, so narrow it here.
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  // Empty/whitespace collapses to undefined: submitting the hero form blank
  // lands here as `?q=`, which must not render a dangling echo line.
  const query = raw?.trim().slice(0, 60) || undefined;

  return (
    <>
      {/* Hero */}
      <section className="bg-green-dark">
        <Container width="article" className="pt-10 pb-[46px]">
          <Heading
            as="h1"
            className="text-[30px] tracking-[-1px] text-balance text-white md:text-[40px] lg:text-[50px]"
          >
            Find a dealer
          </Heading>
          {query && (
            <Text variant="lead" className="mt-4 text-sand">
              We&apos;ll match &ldquo;{query}&rdquo; to accredited dealers near you as soon as the
              directory opens.
            </Text>
          )}
        </Container>
      </section>

      {/* Body */}
      <Container width="article" className="pt-12 pb-16">
        <Text variant="lead" className="max-w-[65ch] text-ink">
          The accredited caravan dealer directory is on its way. Soon you&apos;ll be able to search
          for dealers by suburb, postcode or state, right here.
        </Text>

        <section id="states" className="mt-12">
          <Heading as="h2" className="text-[22px] tracking-[-.5px] text-green md:text-[28px]">
            Browse by state
          </Heading>
          <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
            {STATE_ASSOCIATIONS.map((state) => (
              <li key={state}>
                <Text variant="body" className="text-ink">
                  {state}
                </Text>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <Button href="/buying-guides" variant="primary">
            Read our buying guides
          </Button>
          <Button href="/" variant="outline">
            Back to home
          </Button>
        </div>
      </Container>
    </>
  );
}
