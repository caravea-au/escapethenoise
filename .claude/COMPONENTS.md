# Component Registry — escape-the-noise

The **single list of components that exist**. Claude reads this BEFORE building anything
(`/build-component` + the `nextjs-component-standards` skill) and appends a row after creating
a Tier-1 or Tier-2 component. **If a component isn't listed here, it gets rebuilt — so keep it current.**

Tiers (see `nextjs-component-standards`): **1** global primitive (`components/ui/`) ·
**2** shared pattern (`components/<Name>/`) · **3** one-off, stays inline (not registered).

## How to use
- **Before building:** scan this table + grep `frontend/src/components/`. Match → reuse/extend, don't rebuild.
- **After building:** add the row. Update `used-on` when an existing component is reused on a new section.

## Registry

| Component | Tier | Purpose | Path | Key props | Used on |
|---|---|---|---|---|---|
| Container | 1 | Centred max-width column (marketing/education/article) + gutters | components/ui/Container.tsx | children, width, className | navbar, footer, all home sections |
| Button | 1 | CTA — primary/secondary/outline/glass; Link when `href` set | components/ui/Button.tsx | variant, href, fullWidth, className | navbar, hero, openday, journey, guides, lifestyle, not-found |
| Eyebrow | 1 | Uppercase tracked label above headings (rust/gold) | components/ui/Eyebrow.tsx | tone, className | trustbar, journey, guides, lifestyle |
| Heading | 1 | Oswald display heading; pass `as` for h1/h2/h3 | components/ui/Heading.tsx | as, className | trustbar, journey, guides, lifestyle |
| Link | 1 | Inline rust text link (wraps next/link) | components/ui/Link.tsx | href, children | — |
| Input | 1 | Text input — cream fill, line border, rust focus | components/ui/Input.tsx | (native input props) | — |
| Section | 1 | Cream / dark-green band + vertical rhythm | components/ui/Section.tsx | tone, children | — |
| Text | 1 | Hanken body (body/lead/eyebrow/meta) | components/ui/Text.tsx | as, variant, children | — |
| Navbar | 2 | Global green header w/ reversed lockup + nav + CTA | components/Navbar/Navbar.tsx | — | layout (all pages) |
| Footer | 2 | Global green footer — link columns, states, legal | components/Footer/Footer.tsx | — | layout (all pages) |
| Hero | home | Video hero + headline + search card + glass pills | components/home/Hero.tsx | — | home |
| TrustBar | home | Stats + state-association logo marquee | components/home/TrustBar.tsx | — | home |
| OpenDayCTA | home | Single highlighted event banner | components/home/OpenDayCTA.tsx | — | home |
| JourneySection | home | "What are you looking for?" 4 entry cards | components/home/JourneySection.tsx | — | home |
| BuyingGuides | home | Latest guides — 3 article cards | components/home/BuyingGuides.tsx | — | home |
| LifestyleBand | home | Full-bleed photo band + CTA | components/home/LifestyleBand.tsx | — | home |

> **Note:** an `Input` Tier-1 primitive exists (`components/ui/Input.tsx`) but the hero search
> still uses an inline `<input>` — adopt `Input` there the next time the search is touched.

<!-- Example row once built:
| Button | 1 | Primary/secondary CTA | frontend/src/components/ui/Button.tsx | variant, href, children | home/hero, home/cta |
-->
