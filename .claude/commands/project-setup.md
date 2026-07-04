---
description: ONE-TIME project setup — intake interview (sitemap · Strapi content model · infra readiness) then brand foundation (tokens · fonts · global CSS · Tier-1 · motion kit). Never starts per-page dev until the plan + infra are green.
argument-hint: <export-folder-name>   e.g. /project-setup your-export
---

Establish the **global brand foundation** every component inherits, read from one design export
(produced per `.claude/design-brief.md`). Run this **once** per project (or when the brand system
changes). **The export's `tokens/` + `art-direction.md` are the source of truth — never invent brand
values.** If a value is missing, STOP and ask.

Input: `$ARGUMENTS` = the export folder under `design-input/`. If omitted and only one export exists, use it;
if several, ask which.

**Expected export shape** (from the brief): `tokens/` · `art-direction.md` · `pages/<page>/` · `components/` ·
`content/` · `assets/`. If the export is an older flat one (single `design.md` + HTML), fall back to reading
`design.md` and note it.

## Phase 0 — Project intake (interview → `.claude/PROJECT-PLAN.md`)
Before ANY building, interview the user and write the plan. **Foundation-first: the data and servers a page
needs must exist before that page is built.** Ask, don't assume.
1. **Sitemap** — every page, marked **static vs CMS-driven**, in **build order** (foundation pages/data first).
2. **Content model (Strapi)** — FIRST read what already exists via the `strapi` MCP (`strapi_get_content_types`)
   and list it. Then interview for the rest: content types + fields + relationships (model to the real
   domain — e.g. `Article`, `Author`, `Category`). Reconcile with the sitemap.
3. **Infra readiness** — an ✅/❌ checklist that **BLOCKS per-page development until green**:
   Strapi running locally (`npm run dev:backend`) · Strapi staging/prod URL + `NEXT_PUBLIC_STRAPI_URL` set ·
   staging/deploy target reachable · git remote + protected `main` · domain (if known) · export present in
   `design-input/` · MCP tools connected (`/preflight`).

Write all three into `.claude/PROJECT-PLAN.md` (use the template there) and **ask the user to confirm before
proceeding**. If infra has ❌s, record them and note that `/criteria` + `/build-component` must wait until green.

## Phase 0b — Create the planned Strapi content types (foundation-first)
With the plan confirmed, create the not-yet-existing content types via the `strapi` MCP (fields + relationships
from the plan). Check for duplicate `collectionName` values first. Never write unconditional seed scripts. Don't
build a page that consumes a type before the type exists.

## Phase 1 — Brand foundation (from the export)

## 0. Validate the export FIRST (structured tokens win)
Read `tokens/` (colors, typography, spacing, radii, motion) + `art-direction.md`, then diff against the
exported page HTML and report an **Inconsistency table**: `Item | tokens say | HTML says | resolution`.
**Resolution is always "follow the tokens / art-direction."** Register the **full** documented token set,
not just what a page happened to use.

> **This repo is a baseplate.** You are REPLACING placeholder values, not filling a blank slate:
> the placeholder tokens in `frontend/src/styles/tokens.css`, the placeholder fonts in
> `frontend/src/lib/fonts.ts`, and the header/footer shell + `[project-name]` placeholders in
> `frontend/src/app/layout.tsx`.

## 1. Tailwind theme tokens (Tailwind v4 — CSS-first)
Tailwind v4 here has **no `tailwind.config.js`**. Write **all** colours from `tokens/colors.md` into the
**`@theme {}` block in `frontend/src/styles/tokens.css`** as `--color-*` custom properties (which become
`bg-*` / `text-*` utilities) — register the **full** token set, not a subset. Replace the existing placeholder
`--color-brand-*` tokens. Add `--radius-*` from `tokens/radii.md`, and any `@keyframes` needed by the motion
kit (e.g. `marquee`) from `tokens/motion.md` into `globals.css`. Raw hex in components is forbidden after this.
*(Older flat export: read colours/radii from `design.md`.)*

## 2. Type scale — convert clamp() → Tailwind breakpoint steps (NO clamp, iOS/Safari)
For each role in `tokens/typography.md`, emit fixed Tailwind breakpoint steps. If a size is given as `clamp()`,
**compute each step deterministically** (don't guess): evaluate the clamp's `vw` expression at the breakpoint
width, capped at the clamp max. Example `clamp(40px, 6.6vw, 78px)`: base `40px`; `md` (768px) → 51px; `lg`
(1024px) → 68px; `xl` (1280px) → capped `78px` → `text-[40px] md:text-[51px] lg:text-[68px] xl:text-[78px]`.
Document the full mapping (one row per role).

## 3. Fonts (Google Fonts, via `next/font/google`)
In `frontend/src/lib/fonts.ts`, load the brand fonts from `tokens/typography.md` — **Google Fonts only**
(auto-optimised, no layout shift). Keep the variable contract used by `tokens.css`/`globals.css`:
`--font-display`, `--font-body`, and `--font-serif` if the art direction calls for a serif accent.
Expose theme utilities in `tokens.css` (e.g. `font-display`, `font-sans`, `font-serif`).

## 4. Global CSS + shell
- `frontend/src/app/globals.css`: body defaults (body font, ink on the base surface, global tracking),
  `::selection` accent, a focus-visible accent ring, scrollbar, and `prefers-reduced-motion` collapse — per
  the export's `@layer base`. Keep it minimal; tokens do the rest.
- `frontend/src/app/layout.tsx`: replace the baseplate header/footer shell + `[project-name]` placeholders +
  metadata with the brand's (this is the global chrome every page inherits).

## 5. Tier-1 primitive components (`frontend/src/components/ui/`)
Build the global primitives from `art-direction.md` + `components/components.md`, using the
`nextjs-component-standards` skill:
**Button** (primary / secondary variants), **Link**, **Input**, **Container** (max-width variants),
**Section** (surface / inverse band + vertical rhythm), **Heading/Text** (display + body fonts).
Tailwind-first, tokens only, accessible. Register each in `.claude/COMPONENTS.md`.

## 5b. Motion kit (install once, reuse everywhere)
Per the `motion-standards` skill: ensure `motion` + `lenis` are installed, wrap the app in the
`SmoothScroll` provider (Lenis + `MotionConfig reducedMotion="user"`), and create the reusable primitives in
`frontend/src/components/ui/` + `ui/motion/`: **Reveal, MaskReveal, Marquee, Parallax** (and **ScrollTextReveal,
Typewriter, ImageReveal** when a page needs them). All fail-safe + reduced-motion aware. Register them in
`.claude/COMPONENTS.md`. This is the premium floor every page composes from.

## 6. Brand assets
Copy only the logos/marks actually needed (lockups, icon, state marks) into `frontend/public/`. For raster
images use `npm run optimize:image -- <src> <destUnderPublic> [--mobile]` (WebP, ≤200 KB / ≤100 KB). SVG logos
copy as-is. **Never reference `design-input/` at runtime** — `public/` only. Leave the raw export untracked.

## 7. Report
Summarize: inconsistency table + resolutions, tokens registered, clamp→breakpoint mappings, fonts wired,
Tier-1 components created (+ registry rows). End with: "Foundation ready — run /criteria <page>/<section>."
Do **not** build pages here. Do **not** push. Commit via `/commit`.
