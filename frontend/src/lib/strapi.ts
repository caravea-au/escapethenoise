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
