import type { Metadata } from "next";
import { Suspense } from "react";
import NextLink from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getDirectoryDealers } from "@/lib/strapi";
import { getRecaptchaConfig } from "@/lib/recaptcha";
import {
  CHIP_PREDICATES,
  PARTICIPATING_STATES,
  dealerStateCounts,
  participatingDealers,
  type ChipKey,
  type DealerFilters,
} from "@/lib/dealers";
import { resolveLocationQuery } from "@/lib/au-locations";
import { DealerDirectory } from "@/components/DealerDirectory/DealerDirectory";

const CHIP_KEYS = Object.keys(CHIP_PREDICATES) as ChipKey[];

// PARTICIPATING_STATES lives in lib/dealers.ts, because it drives the state
// TILES here, the state filter dropdown in the client island (ETN-011) and,
// since ETN-012, which dealers the page loads at all.

// Fallback copy — used when live data (dealer count) can't be resolved, so the
// page still reads honestly rather than printing a fabricated number.
const FALLBACK = {
  metaTitle: "Find a Dealer Near You",
  metaDescription:
    "Find caravan dealers near you across Australia. Search by location, brand or van type.",
  eyebrow: "Dealer directory",
  heading: "Find a Dealer Near You",
  subtitleNoCount: "Caravan dealers across Australia. Search by location, brand or van type.",
  subtitleWithCount: (n: number) =>
    `${n} caravan dealers across Australia. Search by location, brand or van type.`,
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
  // canonical state URLs (plus the unfiltered index) crawlable. A state we no
  // longer list is dropped from that set too: the page still resolves for
  // anyone holding the link, but it has nothing on it to index.
  const hasOtherParams = Object.entries(sp).some(([key, value]) => key !== "state" && value !== undefined);
  const isDelistedState = !!state && !PARTICIPATING_STATES.includes(state);
  const noindex = hasOtherParams || isDelistedState;

  const title = state ? `Caravan Dealers in ${state}` : FALLBACK.metaTitle;
  const description = state
    ? `Caravan dealers in ${state}. Search by location, brand or van type.`
    : FALLBACK.metaDescription;
  const ogImage = "/og-image.png";

  return {
    title,
    description,
    alternates: { canonical: "/find-dealer" },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
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

  // getDirectoryDealers throws when Strapi is unreachable or answering in a
  // shape it cannot read, and this app has no route-level error boundary above
  // (site)/, so it is caught here — the branded page must still render, just
  // without live data. Note the distinction the catch preserves: `null` means we
  // could not read the directory (outage panel), whereas an empty array means
  // Strapi answered and holds no PUBLISHED dealers (DealerDirectory's own "none
  // listed yet" panel).
  //
  // Since ETN-013 that read is a Strapi cache of the Caravea Connect feed rather
  // than a live Connect request, which is what puts a last-good floor under this
  // page: an upstream wipe or shape change is now a failed cron sweep in a log,
  // and the directory keeps serving the last complete set it was given. There is
  // deliberately NO live-Connect fallback here — last-good or nothing.
  //
  // getRecaptchaConfig() never throws — and unlike
  // /dealer-directory-onboarding, a recaptcha-config outage must NOT fail this
  // page closed: the directory itself has nothing to do with enquiries, so it
  // renders normally either way (see DealerDirectory's `recaptchaConfigError`,
  // which only affects the enquiry form's copy).
  const [directory, recaptcha] = await Promise.all([
    getDirectoryDealers().catch(() => null),
    getRecaptchaConfig(),
  ]);

  // Destructured rather than returned flat so the null-versus-empty-array
  // distinction above survives: `directory` is null only when the read failed,
  // and `allDealers` keeps carrying exactly that meaning downstream.
  const allDealers = directory?.dealers ?? null;

  // The site-wide enquiry-form switch (Strapi’s Dealer Directory Settings
  // single type), read out of the same response. Fails CLOSED: if we could not
  // read the directory at all then we do not know the switch’s state either, and
  // hiding the form is the safe assumption.
  const enquiryFormEnabled = directory?.enquiryFormEnabled ?? false;

  // The single point where dealers enter the page, and so the only place the
  // participating-states rule has to be applied: the subtitle count, the tiles,
  // the map markers, the filter dropdown and every ?state= URL are all derived
  // from `dealers` below, so they agree by construction. Deliberately NOT done
  // in the Strapi getter or in the sync, because the enquiry controller resolves
  // a dealer by the same id: narrowing upstream of here would refuse enquiries
  // from a delisted dealer's held link instead of just leaving them out of the
  // directory. That is ETN-012's rule and this is where it stays.
  const dealers = allDealers ? participatingDealers(allDealers) : null;

  // State tiles are derived from the very list they link to, so a tile can
  // never advertise a count the filtered page cannot produce. `total` is now
  // the sum of the tiles as well, because both are counted off the same
  // participating-states list. Neither figure is ever hardcoded: the export's
  // own numbers (403+, 480+, tiles summing to 465) contradicted each other and
  // aren't used.
  const counts = dealers ? dealerStateCounts(dealers) : null;
  const total = dealers?.length ?? null;

  // The typed location query is resolved HERE, on the server, against the full
  // AU locality dataset — the 89-entry table the client island searched missed
  // every capital-city postcode (ETN-008). Resolving server-side is what keeps
  // that ~768KB dataset out of the browser: only the resolved
  // `{ coords, label }` crosses into DealerDirectory. `q` travels alongside the
  // origin so the island can never pair one query's text with another's origin.
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const resolvedQuery = { q, origin: q ? resolveLocationQuery(q) : null };

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
            resolvedQuery={resolvedQuery}
            recaptchaEnabled={recaptcha.enabled}
            recaptchaSiteKey={recaptcha.siteKey}
            recaptchaConfigError={recaptcha.configError}
            enquiryFormEnabled={enquiryFormEnabled}
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
              // A state with no published dealer is absent from the derived
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
