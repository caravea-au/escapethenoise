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
| Container | 1 | Centred max-width column (marketing/education/article) + gutters | components/ui/Container.tsx | children, width, className | navbar, footer, all home sections, buying-guides/listing, buying-guides/detail |
| Button | 1 | CTA — primary/secondary/outline/glass/tertiary (solid green); Link when `href` set | components/ui/Button.tsx | variant, href, fullWidth, className | navbar, hero, openday, journey, guides, lifestyle, not-found, buying-guides/listing, buying-guides/detail |
| Eyebrow | 1 | Uppercase tracked label above headings (rust/gold) | components/ui/Eyebrow.tsx | tone, className | trustbar, journey, guides, lifestyle, buying-guides/listing |
| Heading | 1 | Oswald display heading; pass `as` for h1/h2/h3, size/colour via className | components/ui/Heading.tsx | as, className | trustbar, journey, guides, lifestyle, buying-guides/listing, buying-guides/detail |
| Link | 1 | Inline rust text link (wraps next/link) | components/ui/Link.tsx | href, children | — |
| Input | 1 | Text input — cream fill, line border, rust focus | components/ui/Input.tsx | (native input props) | dealer-directory-onboarding |
| Section | 1 | Cream / dark-green band + vertical rhythm | components/ui/Section.tsx | tone, children | — |
| Text | 1 | Hanken body (body/lead/eyebrow/meta) | components/ui/Text.tsx | as, variant, children | buying-guides/listing |
| Navbar | 2 | Global green header w/ reversed lockup + nav + CTA; desktop nav/CTA `hidden md:flex`, collapses behind MobileMenu below md | components/Navbar/Navbar.tsx | — | layout (all pages) |
| MobileMenu | 2 | Client island: `md:hidden` hamburger toggle + dropdown panel of nav links + CTA for < md | components/Navbar/MobileMenu.tsx | menu, cta | navbar |
| Footer | 2 | Global green footer — link columns, states, legal | components/Footer/Footer.tsx | — | layout (all pages) |
| CategoryBadge | 2 | Category pill — `card` (rust on cream) / `hero` (green on gold) | components/CategoryBadge/CategoryBadge.tsx | tone, children | buying-guides/listing, buying-guides/detail |
| GuideCard | 2 | Buying-guide grid card (image + badge + title + excerpt + meta); whole-card link | components/GuideCard/GuideCard.tsx | guide | buying-guides/listing |
| FeaturedGuideCard | 2 | Two-column promoted guide card | components/FeaturedGuideCard/FeaturedGuideCard.tsx | guide | buying-guides/listing |
| BuyingGuidesExplorer | 2 | Client island: category chips + filtered grid of GuideCard | components/BuyingGuidesExplorer/BuyingGuidesExplorer.tsx | guides | buying-guides/listing |
| ArticleBody | 2 | Renders Strapi `blocks` (¶/H2/list/tip callout/links) for a guide | components/ArticleBody/ArticleBody.tsx | blocks | buying-guides/detail |
| DealerOnboardingForm | 2 | Client island: full dealership onboarding form — sticky progress rail, masthead, 7 sections, validation, multipart submit → Strapi | components/DealerOnboardingForm/DealerOnboardingForm.tsx | — | dealer-directory-onboarding |
| FormSection | 2 | Numbered onboarding card (badge + title + subtitle) | components/DealerOnboardingForm/Controls.tsx | num, title, subtitle | dealer-directory-onboarding |
| MultiSelect | 2 | Searchable multi-select w/ removable tag chips | components/DealerOnboardingForm/MultiSelect.tsx | placeholder, options, selected, onChange, invalid | dealer-directory-onboarding |
| TradingHours | 2 | 7-day open/closed + time grid, copy-Monday-to-weekdays | components/DealerOnboardingForm/TradingHours.tsx | hours, onChange | dealer-directory-onboarding |
| PhotoUploader | 2 | Up to 5 image previews w/ add/remove (object URLs) | components/DealerOnboardingForm/PhotoUploader.tsx | files, onChange | dealer-directory-onboarding |
| Hero | home | Video hero + headline + sub; copy overridable via optional eyebrow/title/subtitle/children props; `fullHeight` grows it to fill a flex-column parent (100svh − header/footer) | components/home/Hero.tsx | eyebrow?, title?, subtitle?, fullHeight?, children? | home, dealer-directory-onboarding/thank-you |
| TrustBar | home | Stats + state-association logo marquee | components/home/TrustBar.tsx | — | home |
| OpenDayCTA | home | Single highlighted event banner | components/home/OpenDayCTA.tsx | — | home |
| JourneySection | home | "What are you looking for?" 4 entry cards | components/home/JourneySection.tsx | — | home |
| BuyingGuides | home | Latest guides — 3 article cards | components/home/BuyingGuides.tsx | — | home |
| LifestyleBand | home | Full-bleed photo band + CTA | components/home/LifestyleBand.tsx | — | home |

> **Note:** an `Input` Tier-1 primitive exists (`components/ui/Input.tsx`) but the hero search
> still uses an inline `<input>` — adopt `Input` there the next time the search is touched.
