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
  readTime: string | null;
  featured: boolean;
  author: string | null;
  cardImage: StrapiImage;
  heroImage: StrapiImage;
  content: Block[];
};

/** Resolve a Strapi media path to an absolute URL. */
export function strapiMedia(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

async function strapiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    // ISR: revalidate periodically so CMS edits surface without a redeploy.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Strapi request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

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

export type HomePage = {
  hero: HomeHero;
  trustBar: HomeTrustBar;
  journey: HomeJourney;
  buyingGuidesHeader: HomeSectionHeader;
  lifestyle: HomeLifestyle;
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
