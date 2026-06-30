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
| _none yet — populated by `/project-setup` (Tier-1) and `/build-component` (Tier-2)_ | | | | | |

<!-- Example row once built:
| Button | 1 | Primary/secondary CTA | frontend/src/components/ui/Button.tsx | variant, href, children | home/hero, home/cta |
-->
