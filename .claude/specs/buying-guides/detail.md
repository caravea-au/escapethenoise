# Spec — buying-guides / detail

```
SECTION: buying-guides/detail       Export: CIAA Dealer Directory Website 2.0 Export
Route:   frontend/src/app/buying-guides/[slug]/page.tsx   (server component)
Source:  data-screen="article" in "Find a Dealer - Tailwind.html"  ·  design.md §3/§5/§6
```

## WHAT YOU'LL SEE
A photo hero under a dark-green scrim (back-link, category badge, article title, author + read-time),
then the article body at reading width (paragraphs, section headings, bullet lists, a highlighted tip
callout, inline video links), closing with a footer row: back-to-listing link + "find a dealer" CTA.

## ELEMENTS (in order)
1. **Hero** — `heroImage` background + dark gradient scrim (180deg `.55 → .7 → .94`). Inside: "← Back to Buying Guides" (gold link → `/buying-guides`), category badge (green-on-gold), H1 (white, Oswald), meta row (author · read-time, warm-muted).
2. **Article body** (≤ ~760–820px) — renders the Strapi `content` blocks: paragraphs (17px, leading 1.72), H2 section headings (Oswald, green), bullet lists (rust dot), tip callout (cream + left rust border), YouTube links, image-caption paragraphs.
3. **Footer row** — top hairline; left "← All Buying Guides" (rust link); right "Find your nearest dealer →" CTA (green fill, → `/` or dealer search).

## REUSE MAP
  • Reading-width wrapper (820) → **REUSE `Container`** (`width="article"`).
  • H1 → **REUSE `Heading`** size `"page"` (added in the listing build; design's 28→46 ≈ page 30→50, negligible).
  • Category badge (green-on-gold, on dark hero) → **REUSE `CategoryBadge`** with `tone="hero"` (listing adds `tone="card"`; this build adds the `hero` tone).
  • "Back to Buying Guides" / "All Buying Guides" → **REUSE `Link`** (rust; gold on the dark hero via className).
  • "Find your nearest dealer →" CTA → **EXTEND `Button`**: add `variant="tertiary"` = solid green (`bg-green hover:bg-green-dark text-white`). Justified: the design's article footer + dealer-conversion CTAs use a green fill the primary(rust)/secondary(outline) pair can't express.
  • Article body blocks → **NEW Tier-2 `ArticleBody`** — pure renderer over `lib/strapi.ts` block types: `paragraph`, `heading`→`<h2>`, `list`(unordered, rust-dot `<li>`), `quote`→**tip callout** (cream bg, `border-line`, `border-l-4 border-l-rust`, lightbulb icon), and inline `link` nodes (rust). Server component (no state).
  • Hero image → **`next/image`** (`fill`, cover) via `strapiMedia()`; scrim is an absolute gradient overlay.
  • Meta row + back-links layout → inline **Tier-3** (small flex rows, not registered).

## CONTENT
- **Strapi** (`getBuyingGuideBySlug`): title, slug, category, readTime, author, heroImage, content (blocks).
- **Static UI copy (from export HTML):** "Back to Buying Guides", "All Buying Guides", "Find your nearest dealer →".
- ❓missing copy: none. (Note: inline diagram images from the source were seeded as their caption text; YouTube clips render as labelled links — flagged simplifications, not missing copy.)

## RESPONSIVE (breakpoint steps — no clamp)
- **Hero H1**: 30 / md 40 / lg 50 px. Hero padding ~`pt-10 pb-[46px]`; min height so the scrim reads.
- **Body**: single column at all sizes, constrained to ~760–820px; comfortable side gutters at 320.
- **Footer row**: `flex-wrap` — stacks (link above CTA) under ~480px, single row above.

## INTERACTIONS
- None stateful — fully server-rendered. (Links navigate; no `'use client'`.)
- `prefers-reduced-motion`: CTA hover lift disabled.

## ROUTING
- `generateStaticParams()` from `getBuyingGuideSlugs()` (18 slugs) → static per-guide pages.
- Unknown slug → `notFound()`.
- `generateMetadata()` per guide (title + excerpt) — nice-to-have.

## ACCEPTANCE
- Visual fidelity vs the article screen at **320 / 768 / 1024 / 1440**.
- a11y: one `<h1>`, body section headings as `<h2>`, lists as real `<ul>/<li>`, hero image `alt`, focus rings, sufficient contrast of white text over the scrim.
- `prefers-reduced-motion`: no hover translate.
- Theme tokens only; no `clamp()`; no `design-input/` references.

✅ APPROVED: ☑ (user, build both)
```
