// Strapi REST client for the buying-guide content type.
// Server-side only (App Router server components). Public find/findOne are
// enabled for buying-guide, so no token is required; if STRAPI_API_TOKEN is
// set (e.g. to read drafts) it is sent as a Bearer header.

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";
const TOKEN = process.env.STRAPI_API_TOKEN;

// ── Strapi blocks (rich text) node shapes we render ──────────────────────────
export type TextNode = {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};
export type LinkNode = { type: "link"; url: string; children: TextNode[] };
export type InlineNode = TextNode | LinkNode;

// A blocks node. ArticleBody switches on `type` and reads `children`
// (list children are list-items, handled there) — no need for per-type aliases.
export type Block = { type: string; format?: string; children?: InlineNode[] };

export type StrapiImage = { url: string } | null;

export type BuyingGuide = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  featured: boolean;
  author: string | null;
  cardImage: StrapiImage;
  heroImage: StrapiImage;
  content: Block[];
};

/** Estimated reading time from blocks content, e.g. "5 min read" (~200 wpm). */
export function readTime(content: Block[] | null | undefined): string {
  let words = 0;
  const walk = (node: { text?: string; children?: unknown[] }) => {
    if (!node) return;
    if (typeof node.text === "string") {
      words += node.text.trim().split(/\s+/).filter(Boolean).length;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((c) => walk(c as { text?: string; children?: unknown[] }));
    }
  };
  (content ?? []).forEach((b) => walk(b as { text?: string; children?: unknown[] }));
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** Build a youtube-nocookie embed URL from any common video/playlist URL, else null. */
export function youtubeEmbedSrc(url: string): string | null {
  const u = url.trim();
  const base = "https://www.youtube-nocookie.com/embed/";
  const video = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )?.[1];
  const list = u.match(/[?&]list=([A-Za-z0-9_-]+)/)?.[1];
  if (video) return `${base}${video}${list ? `?list=${list}` : ""}`;
  if (list) return `${base}videoseries?list=${list}`;
  return null;
}

/** Resolve a Strapi media path to an absolute URL. */
export function strapiMedia(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

// Placeholder pool (WebP derived from existing guide photos) for guides that
// have no image of their own. See public/photos/guides/.
const GUIDE_PLACEHOLDERS = [
  "/photos/guides/placeholder-1.webp",
  "/photos/guides/placeholder-2.webp",
  "/photos/guides/placeholder-3.webp",
  "/photos/guides/placeholder-4.webp",
  "/photos/guides/placeholder-5.webp",
];

/** Deterministic placeholder for a guide with no image (stable by slug — no SSR/CSR drift). */
export function guidePlaceholder(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return GUIDE_PLACEHOLDERS[Math.abs(h) % GUIDE_PLACEHOLDERS.length];
}

/** Card image: own card → own hero → placeholder. Always returns a URL. */
export function guideCardImage(g: BuyingGuide): string {
  return strapiMedia(g.cardImage?.url) ?? strapiMedia(g.heroImage?.url) ?? guidePlaceholder(g.slug);
}

/** Hero image: own hero → own card → placeholder. Always returns a URL. */
export function guideHeroImage(g: BuyingGuide): string {
  return strapiMedia(g.heroImage?.url) ?? strapiMedia(g.cardImage?.url) ?? guidePlaceholder(g.slug);
}

async function strapiFetch<T>(path: string, next?: NextFetchOptions): Promise<T> {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    // ISR: revalidate periodically so CMS edits surface without a redeploy.
    // A caller may also register a cache TAG, which is what lets Strapi push an
    // invalidation the moment an editor changes something instead of the page
    // waiting out the window (see app/api/revalidate/route.ts).
    next: { revalidate: 60, ...next },
  });
  if (!res.ok) {
    throw new Error(`Strapi request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Per-call overrides for the Next data cache. Same shape as `RequestInit["next"]`. */
type NextFetchOptions = { revalidate?: number | false; tags?: string[] };

type ListResponse = { data: BuyingGuide[] };

/** All guides, featured first then newest. */
export async function getBuyingGuides(): Promise<BuyingGuide[]> {
  const json = await strapiFetch<ListResponse>(
    "/api/buying-guides?populate=*&pagination[pageSize]=100&sort[0]=featured:desc&sort[1]=publishedAt:desc",
  );
  return json.data;
}

/** One guide by slug, or null if not found. */
export async function getBuyingGuideBySlug(slug: string): Promise<BuyingGuide | null> {
  const json = await strapiFetch<ListResponse>(
    `/api/buying-guides?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`,
  );
  return json.data[0] ?? null;
}

/** All slugs, for generateStaticParams. */
export async function getBuyingGuideSlugs(): Promise<string[]> {
  const json = await strapiFetch<{ data: { slug: string }[] }>(
    "/api/buying-guides?fields[0]=slug&pagination[pageSize]=100",
  );
  return json.data.map((g) => g.slug);
}

// ── Vehicle listing collection type (RV finder) ──────────────────────────────
// Mirrors buying-guide: a collection type with an index grid + [slug] detail.
// The detail body is modelled with structured components (spec sections + icon
// items) — `blocks` isn't allowed inside a Strapi component, so per-section
// `body` is plain text; only `overviewBody` (a content-type field) is blocks.

export type VehicleIcon =
  | "check"
  | "kitchen"
  | "fridge"
  | "aircon"
  | "water"
  | "awning"
  | "battery"
  | "solar"
  | "power"
  | "storage"
  | "bed"
  | "license"
  | "road";

export type VehicleListItem = { text: string; icon: VehicleIcon | null };

export type VehicleSpecSection = {
  label: string;
  body: string | null;
  items: VehicleListItem[] | null;
};

export type VehicleSeo = { metaTitle: string | null; metaDescription: string | null } | null;

export type VehicleListing = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  order: number | null;
  featured: boolean;
  priceFrom: number | null;
  priceTo: number | null;
  watchVideoUrl: string | null;
  cardImage: StrapiImage;
  heroImage: StrapiImage;
  cardFeatures: VehicleListItem[] | null;
  whyChoose: VehicleListItem[] | null;
  overviewHeading: string | null;
  overviewBody: Block[] | null;
  specSections: VehicleSpecSection[] | null;
  seo: VehicleSeo;
};

// Explicit populate — `populate=*` stops at level 1 and `populate=deep` is not
// available in Strapi 5 core, so nested component items (specSections.items)
// and the seo media must be named explicitly.
const VEHICLE_POPULATE = [
  "populate[cardFeatures]=true",
  "populate[whyChoose]=true",
  "populate[specSections][populate][items]=true",
  "populate[cardImage]=true",
  "populate[heroImage]=true",
  "populate[seo][populate]=*",
].join("&");

/** All listings, ordered by `order` then title. */
export async function getVehicleListings(): Promise<VehicleListing[]> {
  const json = await strapiFetch<{ data: VehicleListing[] }>(
    `/api/vehicle-listings?${VEHICLE_POPULATE}&pagination[pageSize]=100&sort[0]=order:asc&sort[1]=title:asc`,
  );
  return json.data;
}

/** One listing by slug, or null if not found. */
export async function getVehicleListingBySlug(slug: string): Promise<VehicleListing | null> {
  const json = await strapiFetch<{ data: VehicleListing[] }>(
    `/api/vehicle-listings?filters[slug][$eq]=${encodeURIComponent(slug)}&${VEHICLE_POPULATE}`,
  );
  return json.data[0] ?? null;
}

/** All slugs, for generateStaticParams. */
export async function getVehicleListingSlugs(): Promise<string[]> {
  const json = await strapiFetch<{ data: { slug: string }[] }>(
    "/api/vehicle-listings?fields[0]=slug&pagination[pageSize]=100",
  );
  return json.data.map((v) => v.slug);
}

// ── Industry partners single type (site-wide partner logos) ──────────────────
export type IndustryPartner = { name: string; url: string | null; logo: StrapiImage };
export type IndustryPartners = {
  heading: string | null;
  partners: IndustryPartner[] | null;
} | null;

/** Key industry partners (logo + link), or null if unset / Strapi is unreachable. */
export async function getIndustryPartners(): Promise<IndustryPartners> {
  try {
    const json = await strapiFetch<{ data: IndustryPartners }>(
      "/api/industry-partners?populate[partners][populate]=logo",
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Header / Footer single types (global chrome) ─────────────────────────────
// A label + URL pair (Strapi `shared.link` component).
export type StrapiLink = { label: string; url: string };
// A footer column (Strapi `shared.link-column` component).
export type LinkColumn = { title: string; links: StrapiLink[] | null };

export type HeaderData = {
  logo: StrapiImage;
  menuItems: StrapiLink[] | null;
  ctaButton: StrapiLink | null;
} | null;

export type FooterData = {
  logo: StrapiImage;
  heading: string | null;
  content: string | null;
  columns: LinkColumn[] | null;
  statesLabel: string | null;
  states: StrapiLink[] | null;
  legalLinks: StrapiLink[] | null;
  copyright: string | null;
} | null;

/** Header single type, or null if unset / Strapi is unreachable (frontend falls back). */
export async function getHeader(): Promise<HeaderData> {
  try {
    const json = await strapiFetch<{ data: HeaderData }>("/api/header?populate=*");
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Footer single type, or null if unset / Strapi is unreachable. Deep-populates nested column links. */
export async function getFooter(): Promise<FooterData> {
  try {
    const json = await strapiFetch<{ data: FooterData }>(
      "/api/footer?populate[logo]=true&populate[columns][populate][links]=true&populate[states]=true&populate[legalLinks]=true",
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Privacy policy single type ───────────────────────────────────────────────
export type PrivacyPolicy = {
  title: string | null;
  lastUpdated: string | null;
  content: Block[] | null;
};

/** Privacy policy content, or null if unset / Strapi is unreachable. */
export async function getPrivacyPolicy(): Promise<PrivacyPolicy | null> {
  try {
    const json = await strapiFetch<{ data: PrivacyPolicy | null }>(
      "/api/privacy-policy?populate=*",
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Home page single type ────────────────────────────────────────────────────
// Every field is nullable: the frontend keeps its hardcoded content as a fallback
// and only overrides where Strapi has a value (getHomePage returns null on error).

export type HomeStat = { value: string | null; showPlus: boolean | null; label: string | null };
export type HomeLogo = { image: StrapiImage; alt: string | null };
export type HomeJourneyCard = {
  icon: "compass" | "tent" | "van" | null;
  title: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  featured: boolean | null;
};

export type HomeHero = {
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  backgroundVideo: StrapiImage;
  backgroundPoster: StrapiImage;
  searchPlaceholder: string | null;
  searchCtaLabel: string | null;
  locationChipLabel: string | null;
  stateChipLabel: string | null;
} | null;

export type HomeTrustBar = {
  eyebrow: string | null;
  heading: string | null;
  stats: HomeStat[] | null;
  partnersEyebrow: string | null;
  partnersHeading: string | null;
  stateLogos: HomeLogo[] | null;
  ciaaLabel: string | null;
  ciaaLogo: StrapiImage;
} | null;

export type HomeJourney = {
  eyebrow: string | null;
  heading: string | null;
  cards: HomeJourneyCard[] | null;
} | null;

export type HomeSectionHeader = {
  eyebrow: string | null;
  heading: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
} | null;

export type HomeLifestyle = {
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  backgroundImage: StrapiImage;
  ctaLabel: string | null;
  ctaUrl: string | null;
} | null;

export type HomeOpenDay = {
  badge: string | null;
  heading: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
} | null;

export type HomePage = {
  hero: HomeHero;
  trustBar: HomeTrustBar;
  journey: HomeJourney;
  buyingGuidesHeader: HomeSectionHeader;
  lifestyle: HomeLifestyle;
  openDay: HomeOpenDay;
};

// Explicit deep populate — Strapi 5's `populate=*` stops at the first level and
// won't reach nested component media (e.g. each stateLogo's image).
const HOME_POPULATE = [
  "populate[hero][populate]=*",
  "populate[trustBar][populate][stats]=true",
  "populate[trustBar][populate][stateLogos][populate]=*",
  "populate[trustBar][populate][ciaaLogo]=true",
  "populate[journey][populate][cards]=true",
  "populate[buyingGuidesHeader]=true",
  "populate[lifestyle][populate]=*",
  "populate[openDay]=true",
  "populate[seo][populate]=*",
].join("&");

/** Home page content, or null if unset / Strapi is unreachable (frontend falls back). */
export async function getHomePage(): Promise<HomePage | null> {
  try {
    const json = await strapiFetch<{ data: HomePage | null }>(`/api/home-page?${HOME_POPULATE}`);
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Vehicle listings page single type ────────────────────────────────────────
// Page-level chrome (hero / quiz CTA / SEO) for the /vehicle-listings index.
// The vehicle cards themselves come from getVehicleListings() — this is only the
// surrounding copy. Every field is nullable: the page keeps its hardcoded copy as
// a fallback and getVehicleListingsPage returns null on error.

// Shared SEO component (shared.seo), incl. the ogImage that VehicleSeo omits.
export type Seo = {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: StrapiImage;
} | null;

export type VehicleListingsPage = {
  heroEyebrow: string | null;
  heroHeading: string | null;
  heroLead: string | null;
  surveyUrl: string | null;
  quizButtonLabel: string | null;
  emptyStateText: string | null;
  ctaHeading: string | null;
  ctaLead: string | null;
  ctaButtonLabel: string | null;
  seo: Seo;
};

// Explicit populate — Strapi 5's `populate=*` won't reach the seo component's ogImage media.
const VEHICLE_LISTINGS_PAGE_POPULATE = "populate[seo][populate]=*";

/** Vehicle-listings page content, or null if unset / Strapi is unreachable (frontend falls back). */
export async function getVehicleListingsPage(): Promise<VehicleListingsPage | null> {
  try {
    const json = await strapiFetch<{ data: VehicleListingsPage | null }>(
      `/api/vehicle-listings-page?${VEHICLE_LISTINGS_PAGE_POPULATE}`,
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Dealer directory ─────────────────────────────────────────────────────────
// Sanitised, allow-listed shape rendered by /find-dealer, read from Strapi via
// GET /api/dealers.
//
// That endpoint no longer serves the onboarding table. Since ETN-013 it serves
// the `dealer` collection: a CACHE of the Caravea Connect dealer feed, filled by
// a cron sweep inside Strapi and gated by Strapi own draft/publish state. The
// frontend therefore makes ZERO requests to Connect, deliberately, and it is
// worth keeping it that way — reading Connect live from here made it
// simultaneously the source of truth, the availability dependency AND the only
// place dealer visibility could be controlled, so an upstream wipe became a
// client-facing content outage in under five minutes. That happened on
// 2026-08-20 and the page reported it as a perfectly normal empty directory.
//
// The shape below is UNCHANGED by that swap, which is what leaves search, the
// radius rule, the participating-states narrowing and the map camera alone.

export type DealerTradingDay = { open: boolean; openTime: string; closeTime: string };
export type DealerTradingHours = Record<
  "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
  DealerTradingDay
> | null;

export type DirectoryDealer = {
  // Connect's `reference`, not a Strapi documentId — /api/dealers publishes the
  // cache row's `connectRef` under this name. Kept under this name because it is
  // what cards, map pins and the enquiry POST key on, and it has to survive the
  // cache being rebuilt from scratch: a Strapi documentId would not, and every
  // enquiry ever filed would lose its subject.
  documentId: string;
  dealershipName: string;
  street: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  logo: string | null;
  photos: string[];
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  googleProfile: string | null;
  tradingHours: DealerTradingHours;
  services: string[];
  servicesOther: string | null;
  brands: string[];
  brandsOther: string | null;
  productTypes: string[];
  productsOther: string | null;
  stockCondition: "New" | "Used" | "Both" | null;
  financeAvailable: boolean | null;
  deliveryAvailable: boolean | null;
  rvmapBadged: boolean | null;
  rvmasterBadged: boolean | null;
  established: number | null;
  multipleLocations: boolean | null;
  stateAssociation: string | null;
  // Map position: columns on the dealer record, served flat by /api/dealers.
  // Null when that dealer has no coordinates yet, in which case dealerPoint()
  // falls back to the postcode centroid. `precision` is "street" only when the
  // coordinate is good enough to quote a distance without a "~". The dealer's
  // other three coordinate fields (geocodeSource, matchedAddress,
  // geocodedAddress) are private and deliberately never reach this response.
  latitude: number | null;
  longitude: number | null;
  precision: "street" | "approx" | null;

  // Whether Connect has approved this dealer. BADGE ONLY (ETN-006): visibility
  // is the Strapi publish toggle (ETN-013), not this, and the enquiry form is
  // gated on `hasCaraveaCompanyId` below, not on this. Defaults to false on
  // anything we cannot read, so an unreadable approval state never claims
  // accreditation.
  approved: boolean;

  // Whether Connect has issued this dealer a company id, and so whether they can
  // be sent an enquiry at all (ETN-017). Derived server-side: the id itself is
  // private to Strapi and never crosses this boundary, and `canEnquire` in
  // lib/dealers is the only thing that should read this field.
  //
  // NOT the same question as `approved`, even though the two agree on every
  // dealer measured so far. Connect mints the id on approval, so an approval it
  // has not yet minted an id for would show the badge with no form, and that is
  // the correct behaviour rather than a bug: there would be no company to
  // attribute the lead to.
  hasCaraveaCompanyId: boolean;

  // Connect's raw company id, published so the enquiry form can carry it as a
  // hidden <input> for the Basecamp CRM pixel, which reads form fields out of
  // the DOM rather than the JSON POST body. Null exactly when
  // `hasCaraveaCompanyId` is false (same server-side normalisation, so they can
  // never drift). The backend still resolves the id it stores on the enquiry
  // server-side off the cache row and never trusts this value.
  caraveaCompanyId: string | null;
};

// Dealer photos/logo are absolute DigitalOcean Spaces URLs, not Strapi media —
// never run them through strapiMedia (which would wrongly prefix them with STRAPI_URL).
/** Card image: first photo → logo → null. */
export function dealerCardImage(d: DirectoryDealer): string | null {
  return d.photos[0] ?? d.logo ?? null;
}

/** The Next cache tag the dealer read registers under. Strapi POSTs this to /api/revalidate. */
export const DEALERS_TAG = "dealers";

/**
 * Every dealer the directory may show, from the Strapi cache.
 *
 * THROWS when Strapi is unreachable or answering in a shape this cannot read.
 * find-dealer/page.tsx depends on that distinction: a throw means "we could not
 * load the directory" (outage panel), an empty array means "Strapi answered and
 * holds no published dealers" (the calm "none listed yet" panel). Those are very
 * different messages to a visitor, and conflating them is exactly how two
 * upstream incidents went unnoticed.
 *
 * Only PUBLISHED dealers come back — the endpoint filters on `publishedAt`, and
 * that is the whole publication gate. Unpublishing a dealer in Strapi removes
 * them from the cards, the subtitle count, the state tiles, the map markers and
 * the filter dropdown at once, because all five are derived from this one array.
 *
 * Also carries the SITE-WIDE enquiry-form switch out of the response meta. It
 * rides here rather than having a fetch of its own because this page already
 * calls this endpoint, and because the switch then sits under the same
 * `dealers` cache tag, so one revalidation covers the list and the switch
 * together instead of letting them disagree for up to a minute.
 *
 * Tagged so Strapi can invalidate it the instant someone flips that toggle rather
 * than the change waiting out the 60 second window. Worth knowing why the tag
 * earns its keep: Next data cache is stale-while-revalidate and does not move at
 * all without traffic, so without it the first visitor after expiry still sees
 * the old list and merely triggers a refresh for whoever comes next.
 */
export async function getDirectoryDealers(): Promise<{
  dealers: DirectoryDealer[];
  enquiryFormEnabled: boolean;
}> {
  const json = await strapiFetch<{
    data: DirectoryDealer[];
    meta?: { enquiryFormEnabled?: unknown };
  }>("/api/dealers", {
    tags: [DEALERS_TAG],
  });

  if (!Array.isArray(json.data)) {
    throw new Error("Strapi /api/dealers returned an unrecognised shape");
  }

  return {
    dealers: json.data,
    // === true, so a missing or malformed meta reads as OFF. This fails closed
    // on purpose: not knowing the switch’s state must never be the thing that
    // publishes an enquiry form.
    enquiryFormEnabled: json.meta?.enquiryFormEnabled === true,
  };
}
