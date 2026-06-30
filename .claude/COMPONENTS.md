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
| Button | 1 | Primary (rust) / secondary (outline) CTA; renders `<a>` when `href` given | frontend/src/components/ui/Button.tsx | variant, href, children | — |
| Link | 1 | Inline rust text link (wraps next/link) | frontend/src/components/ui/Link.tsx | href, children | — |
| Input | 1 | Text input — cream fill, line border, rust focus | frontend/src/components/ui/Input.tsx | (native input props) | — |
| Container | 1 | Max-width wrapper (1280/1180/820) + 24px gutters | frontend/src/components/ui/Container.tsx | width, children | layout shell |
| Section | 1 | Cream / dark-green band + vertical rhythm | frontend/src/components/ui/Section.tsx | tone, children | — |
| Heading | 1 | Oswald display (hero/section/stat/card steps) | frontend/src/components/ui/Heading.tsx | as, size, children | — |
| Text | 1 | Hanken body (body/lead/eyebrow/meta) | frontend/src/components/ui/Text.tsx | as, variant, children | — |

<!-- Example row once built:
| Button | 1 | Primary/secondary CTA | frontend/src/components/ui/Button.tsx | variant, href, children | home/hero, home/cta |
-->
