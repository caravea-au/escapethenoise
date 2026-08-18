import type { Metadata } from "next";
import { Suspense } from "react";
import NextLink from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { connectStateCounts, getConnectDealers } from "@/lib/connect";
import { getRecaptchaConfig } from "@/lib/recaptcha";
import { CHIP_PREDICATES, type ChipKey, type DealerFilters } from "@/lib/dealers";
import { DealerDirectory } from "@/components/DealerDirectory/DealerDirectory";

const CHIP_KEYS = Object.keys(CHIP_PREDICATES) as ChipKey[];

// The states this dealer programme actually operates in. Drives the state
// TILES ONLY: dealers in every other state and territory stay listed, mapped
// and filterable (?state=SA still works and the filter dropdown still offers
// it), because they are still real dealers in the directory.
const PARTICIPATING_STATES = ["NSW", "VIC", "QLD"] as const;

// Fallback copy — used when live data (dealer count) can't be resolved, so the
// page still reads honestly rather than printing a fabricated number.
const FALLBACK = {
  metaTitle: "Find a Dealer Near You",
  metaDescription:
    "Find accredited caravan dealers near you across Australia. Search by location, brand or van type.",
  eyebrow: "Dealer directory",
  heading: "Find a Dealer Near You",
  subtitleNoCount: "Accredited caravan dealers across Australia. Search by location, brand or van type.",
  subtitleWithCount: (n: number) =>
    `${n} accredited caravan dealers across Australia. Search by location, brand or van type.`,
  stateHeading: "Select Your State",
  outageHeading: "We can't load the dealer directory right now",
  outageBody: "Please try again shortly, or search for your state below.",
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state.toUpperCase() : undefined;
  // Any filter permutation beyond ?state shouldn't be indexed — keeps only the
  // 8 canonical state URLs (plus the unfiltered index) crawlable.
  const hasOtherParams = Object.entries(sp).some(([key, value]) => key !== "state" && value !== undefined);

  const title = state ? `Caravan Dealers in ${state}` : FALLBACK.metaTitle;
  const description = state
    ? `Accredited caravan dealers in ${state}. Search by location, brand or van type.`
    : FALLBACK.metaDescription;
  const ogImage = "/og-image.png";

  return {
    title,
    description,
    alternates: { canonical: "/find-dealer" },
    ...(hasOtherParams ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: "/find-dealer",
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

export default async function FindDealerPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const stateParam = typeof sp.state === "string" ? sp.state.toUpperCase() : undefined;

  // getConnectDealers throws when Connect is unreachable or unconfigured, and
  // this app has no route-level error boundary above (site)/, so it is caught
  // here — the branded page must still render, just without live data. Note
  // the distinction the catch preserves: `null` means we could not read the
  // directory (outage panel), whereas an empty array means Connect answered
  // and holds no dealers for us (DealerDirectory's own "none listed yet"
  // panel). Right now the empty case is the honest one.
  //
  // getRecaptchaConfig() never throws — and unlike
  // /dealer-directory-onboarding, a recaptcha-config outage must NOT fail this
  // page closed: the directory itself has nothing to do with enquiries, so it
  // renders normally either way (see DealerDirectory's `recaptchaConfigError`,
  // which only affects the enquiry form's copy).
  const [dealers, recaptcha] = await Promise.all([
    getConnectDealers().catch(() => null),
    getRecaptchaConfig(),
  ]);

  // State tiles are derived from the very list they link to, so a tile can
  // never advertise a count the filtered page cannot produce. `total` is the
  // whole directory and NOT the sum of the tiles: only participating states
  // get a tile, so the tile counts deliberately sum to less than the
  // subtitle's total. That gap is intended, not a counting bug. Neither
  // figure is ever hardcoded — the export's own numbers (403+, 480+, tiles
  // summing to 465) contradicted each other and aren't used.
  const counts = dealers ? connectStateCounts(dealers) : null;
  const total = dealers?.length ?? null;

  const chipParam = typeof sp.chip === "string" && CHIP_KEYS.includes(sp.chip as ChipKey) ? (sp.chip as ChipKey) : null;
  const initialFilters: DealerFilters = {
    state: stateParam,
    brand: typeof sp.brand === "string" ? sp.brand : undefined,
    productType: typeof sp.type === "string" ? sp.type : undefined,
    service: typeof sp.service === "string" ? sp.service : undefined,
    chips: chipParam ? [chipParam] : [],
  };

  return (
    <>
      <section className="bg-[linear-gradient(150deg,var(--color-green),var(--color-green-dark))]">
        <Container width="marketing" className="pt-11 pb-10">
          <Eyebrow tone="gold">{FALLBACK.eyebrow}</Eyebrow>
          <Heading as="h1" className="mt-2.5 text-[28px] text-white md:text-[32px] lg:text-[42px]">
            {FALLBACK.heading}
          </Heading>
          <Text variant="lead" className="mt-2 max-w-[620px] text-sand">
            {total !== null ? FALLBACK.subtitleWithCount(total) : FALLBACK.subtitleNoCount}
          </Text>
        </Container>
      </section>

      {dealers === null ? (
        <Container width="marketing" className="py-16">
          <div className="rounded-card border border-line bg-white px-6 py-10 text-center">
            <Heading as="h2" className="text-[22px] text-green">
              {FALLBACK.outageHeading}
            </Heading>
            <Text variant="lead" className="mx-auto mt-2.5 max-w-[520px] text-muted">
              {FALLBACK.outageBody}
            </Text>
          </div>
        </Container>
      ) : (
        <Suspense fallback={null}>
          <DealerDirectory
            dealers={dealers}
            initialFilters={initialFilters}
            recaptchaEnabled={recaptcha.enabled}
            recaptchaSiteKey={recaptcha.siteKey}
            recaptchaConfigError={recaptcha.configError}
            mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null}
          />
        </Suspense>
      )}

      <section className="border-t border-line bg-white">
        <Container width="marketing" className="pt-[60px] pb-[72px] text-center">
          <Heading as="h2" className="text-[24px] text-green md:text-[28px] lg:text-[32px]">
            {FALLBACK.stateHeading}
          </Heading>
          <div className="mx-auto mt-8 grid max-w-[980px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3.5 lg:grid-cols-3">
            {PARTICIPATING_STATES.map((abbr) => {
              // A state Connect has no dealer in is absent from the derived
              // counts, which is a real zero — not unknown data. Only a failed
              // read leaves the count off the tile entirely.
              const count = counts ? (counts[abbr] ?? 0) : undefined;
              const isEmpty = count === 0;
              return (
                <NextLink
                  key={abbr}
                  href={`/find-dealer?state=${abbr}`}
                  className={`rounded-[13px] border border-line bg-white px-3 py-5 shadow-[0_3px_10px_rgba(22,39,28,.05)] transition ${
                    isEmpty ? "opacity-60" : "hover:border-rust"
                  }`}
                >
                  <div className="font-oswald text-[26px] font-bold text-green">{abbr}</div>
                  {count !== undefined && (
                    <div className="mt-[5px] text-[12.5px] text-muted">
                      {count} {count === 1 ? "dealer" : "dealers"}
                    </div>
                  )}
                </NextLink>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
