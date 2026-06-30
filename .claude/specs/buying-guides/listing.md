# Spec — buying-guides / listing

```
SECTION: buying-guides/listing      Export: CIAA Dealer Directory Website 2.0 Export
Route:   frontend/src/app/buying-guides/page.tsx   (server component)
Source:  data-screen="education" in "Find a Dealer - Tailwind.html"  ·  design.md §2/§3/§5/§6
```

## WHAT YOU'LL SEE
A dark-green gradient page hero ("Education / Buying Guides & Caravan Advice"), then a cream body
holding a row of category filter pills, one large featured-guide card, and a responsive grid of
guide cards — all driven by the Strapi `buying-guide` collection.

## ELEMENTS (in order)
1. **Hero band** — green gradient (`green-mid → green-dark`, 165deg). Eyebrow "Education" (gold),
   H1 "Buying Guides & Caravan Advice" (white, Oswald), lead subhead (max 600px).
2. **Category chips** — "All Topics" + the 6 categories present in the data; active = filled green,
   idle = white + line border; pill radius. Clicking filters the grid.
3. **Featured guide card** — 2-column (image | content): "Featured guide" label, title, excerpt,
   "Read the guide →" button (links to detail), read-time. (The one guide with `featured: true`.)
4. **Guide grid** — responsive auto-fit cards: image, category badge, title, excerpt, read-time + arrow;
   whole card links to `/buying-guides/<slug>`.

## REUSE MAP
  • Page max-width wrapper (1180) → **REUSE `Container`** (`width="content"`).
  • Hero eyebrow "Education" → **REUSE `Text`** (`variant="eyebrow"` + `text-gold`, tracking/bold tweak via className).
  • Hero H1 (clamp 30→50) → **EXTEND `Heading`**: add size `"page"` = `text-[30px] md:text-[40px] lg:text-[50px] font-bold tracking-[-1px]`. Justified: education **and** events heroes share this exact clamp (2 known uses, not speculative).
  • Hero subhead → **REUSE `Text`** (`variant="lead"` + `text-sand` — design.md-documented muted-on-dark token; HTML's ad-hoc `#c4b89b` is not in the palette, design.md wins).
  • "Read the guide →" CTA → **REUSE `Button`** (`variant="primary"`, `href`).
  • Category pill (rust-on-cream badge on cards) → **NEW Tier-2 `CategoryBadge`** (shared with the detail page — known 2nd use, so extract now not later).
  • Featured card → **NEW Tier-2 `FeaturedGuideCard`** (2-col; composes `CategoryBadge`-style label + `Button`).
  • Guide card → **NEW Tier-2 `GuideCard`** (image + `CategoryBadge` + title + excerpt + meta; whole-card link).
  • Chips + filtered grid (stateful) → **NEW Tier-2 `BuyingGuidesExplorer`** (`'use client'`). Holds active-category state, derives categories from the guides, renders the chips (inline Tier-3 spans) + the filtered grid of `GuideCard`.
  • Images → **`next/image`** via `strapiMedia(url)` from `lib/strapi.ts`.
  • Section bands / vertical rhythm → plain `<section>` with explicit padding (hero uses a custom gradient, so **not** the cream/green `Section` primitive here).

## CONTENT
- **Strapi** (`getBuyingGuides`, `getFeaturedGuide`): title, slug, category, excerpt, readTime, featured, cardImage. Categories for chips are derived from the returned guides.
- **Static UI copy (from the export HTML, not invented):** eyebrow "Education"; H1 "Buying Guides & Caravan Advice"; subhead "Independent, jargon-free guidance from the Caravan Industry Association — so you buy with confidence."; "Featured guide"; "Read the guide →"; "All Topics".
- ❓missing copy: none.

## RESPONSIVE (breakpoint steps — no clamp)
- **Hero H1**: 30 / md 40 / lg 50 px. Hero padding ~`pt-[54px] pb-[50px]`.
- **Featured card**: <768 stacked (image on top, ~h-[220px]); ≥768 two columns (image left, content right).
- **Guide grid**: 320 → 1 col · 640/768 → 2 col · ≥1024 → 3 col (CSS `grid` with `auto-fit minmax(280px,1fr)`, `gap-6`).
- **Chips**: `flex-wrap`, scroll/stack naturally on narrow.

## INTERACTIONS
- **Category filter** (`'use client'` in `BuyingGuidesExplorer`): selecting a chip filters the visible grid by `category`; "All Topics" shows all. Chips are real `<button>`s with `aria-pressed`. Featured card stays visible regardless (or is excluded from grid to avoid duplication — excluded).
- Card hover: subtle `-translate-y` lift + shadow; **disabled under `prefers-reduced-motion`**.

## ACCEPTANCE
- Visual fidelity vs the education screen at **320 / 768 / 1024 / 1440**.
- a11y: one `<h1>`, card titles as headings, `<button>` chips with `aria-pressed`, descriptive `alt` (guide title), visible focus rings.
- `prefers-reduced-motion`: no hover translate/transition.
- All copy/images from Strapi; theme tokens only (no raw hex); no `clamp()`; no `design-input/` references.

✅ APPROVED: ☑ (user, build both)
```
