---
description: ONE-TIME global setup from a design export — brand tokens, fonts, global CSS, Tier-1 primitives. Validates the export against design.md first.
argument-hint: <export-folder-name>   e.g. /project-setup ciaa-dealer-directory
---

Establish the **global brand foundation** every component inherits, read from one design export.
Run this **once** per project (or when the brand system changes). **design.md is the single source
of truth — never invent brand values.** If `design.md` is missing a value, STOP and ask.

Input: `$ARGUMENTS` = the export folder under `design-input/`. If omitted and only one export exists, use it;
if several, ask which.

## 0. Validate the export against design.md FIRST (the user's explicit requirement)
Before generating anything, **diff the exported Tailwind HTML's tokens against `design.md`** and report:
- **Colours:** every token in `design.md` §2 vs the `tailwind.config` block in the HTML. Flag any documented
  token the export did NOT register (the sample omits Tag-text, Star-rating, Service-pin, Open/Closed badges),
  and any hex in the HTML that isn't in `design.md`.
- **Type scale:** §3 sizes vs actual classes used.
- **Fonts, radii, shadows, motion:** §3/§6/§8 vs the HTML.

Print an **Inconsistency table**: `Item | design.md says | export says | resolution`. **Resolution is always
"follow design.md."** Then proceed using the design.md values (register the *full* documented token set, not
just what the export happened to wire).

> **This repo is a baseplate.** You are REPLACING placeholder values, not filling a blank slate:
> `frontend/src/styles/tokens.css` (orange `#f56024` tokens), `frontend/src/lib/fonts.ts` (Goldman/Work_Sans),
> and the header/footer shell + `[project-name]` placeholders in `frontend/src/app/layout.tsx`.

## 1. Tailwind theme tokens (Tailwind v4 — CSS-first)
Tailwind v4 here has **no `tailwind.config.js`**. Write **all** `design.md` colour tokens into the
**`@theme {}` block in `frontend/src/styles/tokens.css`** as `--color-*` custom properties (which become
`bg-*` / `text-*` utilities): green{DEFAULT,dark,mid}, rust{DEFAULT,dark}, cream{DEFAULT,deep}, gold, ink,
muted, sand, line, **plus** the support colours (tag, star, service-pin, badge-open, badge-closed). Replace the
existing placeholder `--color-brand-*` tokens. Add `--radius-*` per design.md §6. Define keyframes
(`marquee`, `pop`, `ping2`) in `globals.css`. Raw hex in components is forbidden after this.

## 2. Type scale — convert clamp() → Tailwind breakpoint steps (NO clamp, iOS/Safari)
For each `design.md` §3 role, emit fixed Tailwind breakpoint steps. **Compute each step deterministically**
(don't guess): evaluate the clamp's `vw` expression at the breakpoint width, capped at the clamp max.
Example `Hero H1 clamp(40px, 6.6vw, 78px)`: base `40px` (min); `md` (768px) → 6.6vw = 51px; `lg` (1024px)
→ 68px; `xl` (1280px) → capped at `78px` → `text-[40px] md:text-[51px] lg:text-[68px] xl:text-[78px]`.
Document the full mapping (one row per role) so it's reusable.

## 3. Fonts
In `frontend/src/lib/fonts.ts`, **replace** Goldman/Work_Sans with **Oswald** (display) + **Hanken Grotesk**
(body) via `next/font/google`; wire weights per §3 (Oswald 400–700, Hanken 400–800). **Keep the existing
variable contract** — `--font-display` / `--font-body` — since `globals.css` and `layout.tsx` reference them.

## 4. Global CSS + shell
- `frontend/src/app/globals.css`: body defaults (font-body, ink on cream, global tracking `-0.01em`),
  `::selection` rust, focus-visible rust ring, scrollbar, and `prefers-reduced-motion` collapse — per the
  export's `@layer base`. Keep it minimal; tokens do the rest.
- `frontend/src/app/layout.tsx`: replace the baseplate header/footer shell + `[project-name]` placeholders +
  metadata with the brand's (this is the global chrome every page inherits).

## 5. Tier-1 primitive components (`frontend/src/components/ui/`)
Build the global primitives from `design.md` §6, using the `nextjs-component-standards` skill:
**Button** (primary rust / secondary outline), **Link**, **Input**, **Container** (max-width variants
1280/1180/820), **Section** (cream / dark-green band + vertical rhythm), **Heading/Text** (Oswald display +
Hanken body). Tailwind-first, tokens only, accessible. Register each in `.claude/COMPONENTS.md`.

## 6. Brand assets
Copy only the logos/marks actually needed (lockups, icon, state marks) into `frontend/public/`. For raster
images use `npm run optimize:image -- <src> <destUnderPublic> [--mobile]` (WebP, ≤200 KB / ≤100 KB). SVG logos
copy as-is. **Never reference `design-input/` at runtime** — `public/` only. Leave the raw export untracked.

## 7. Report
Summarize: inconsistency table + resolutions, tokens registered, clamp→breakpoint mappings, fonts wired,
Tier-1 components created (+ registry rows). End with: "Foundation ready — run /criteria <page>/<section>."
Do **not** build pages here. Do **not** push. Commit via `/commit`.
