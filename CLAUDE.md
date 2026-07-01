# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

npm workspaces monorepo (this repo is a **baseplate/starter** — `project-baseplate-monorepo`, with `[project-name]` placeholders to replace):
- `frontend/` — Next.js 16.2, React 19, TypeScript 5.8, **Tailwind CSS 4 (CSS-first: tokens in `@theme {}` inside `src/styles/tokens.css`, no `tailwind.config.js`)**
- `backend/` — Strapi 5.40.0 CMS, SQLite (`better-sqlite3`)
- `npm run lint` runs **ESLint 9 flat config** (`frontend/eslint.config.mjs`, bridges `eslint-config-next` via `FlatCompat`) — `next lint` was removed in Next 16. (Pre-existing baseplate lint errors in `layout.tsx`/`not-found.tsx` clear when `/project-setup` replaces those files.)
- `app.js` — production Node.js HTTP wrapper around Next.js (reads `PORT`, binds `0.0.0.0`, serves from `frontend/`)

## Commands

All commands run from the repo root unless noted.

```bash
npm run dev              # Next.js dev server
npm run dev:backend      # Strapi dev server
npm run dev:backend:clean  # clean generated output, then Strapi dev
npm run build            # Next.js production build
npm run build:backend    # Strapi production build
npm run lint             # ESLint 9 flat config (eslint .) — next lint removed in Next 16
npm start                # production server (node app.js)
```

Stop dev servers after completing a task — do not leave them running.

If `better-sqlite3` throws `NODE_MODULE_VERSION` errors, run `npm rebuild better-sqlite3` from `backend/`. Prefer Node 20 or 22 (engine range: >=20 <=24).

## Frontend Structure

```
frontend/src/app/             ← Next.js App Router route files
frontend/src/components/ui/    ← Tier-1 global primitives (Button, Container, Section…)
frontend/src/components/<Name>/ ← Tier-2 shared patterns (Card, Navbar…)
frontend/src/components/ui/motion/ ← motion primitives (Reveal, MaskReveal, Parallax…)
frontend/src/styles/          ← tokens.css + global CSS
frontend/src/lib/fonts.ts
frontend/public/              ← static assets
```

**Component tiers** (full rules in `.claude/skills/nextjs-component-standards`):
- **Tier 1 — global primitives** (Button, Link, Input, Container, Section, Heading/Text): created at `/project-setup`, live in `components/ui/`. These are deliberate, known reuse — build them up front.
- **Tier 2 — shared patterns**: created the **first** time a section needs one, live in `components/<Name>/`.
- **Tier 3 — one-off**: stay inline in the route until a second section needs them.

Do not pre-build Tier-2/3 abstractions before reuse exists. Every Tier-1/Tier-2 component is recorded in `.claude/COMPONENTS.md` — **check it before building so nothing is rebuilt.** Files: `Component.tsx` (+ `Component.module.css` only when Tailwind can't express the style).

## CSS & Layout Rules

- **Tailwind-first.** Use Tailwind utilities; drop to custom CSS (`Component.module.css`, `@layer`) only when Tailwind genuinely can't express it. Tailwind's `rem`-based spacing scale is accepted as the trade-off of going Tailwind-first.
- **No `clamp()`** for responsive sizing (it misbehaves on iOS/Safari) — use **Tailwind breakpoint steps** instead, e.g. `text-[40px] md:text-[60px] lg:text-[78px]`.
- **Theme tokens only — never raw hex.** Colours come from the Tailwind theme set in `/project-setup` (`text-rust`, `bg-green`). Add a token before using a new colour.
- Layout priority: document flow → flexbox → CSS grid → `position: absolute` (last resort, only for overlays, badges, decorative elements that cannot participate in flow). Use `gap`, not margin-based inline spacing.
- Images: `next/image`, WebP format, ≤200 KB desktop / ≤100 KB mobile.

## AI Build Workflow (Claude) — premium pipeline

The premium floor is guaranteed by: **locked tokens + an art-direction spec + our own motion kit +
a machine/taste gate** — not by any component library. Taste is set ONCE (design phase, you approve);
conversion **composes + conforms**, it does not improvise.

**Design phase (before this repo):** ask Claude-design to produce the export by uploading
`.claude/design-brief.md`. It returns a **structured** export: `tokens/` · `art-direction.md` ·
`pages/<page>/{<page>.html, <page>.motion.md}` · `components/` · `content/` · `assets/`.

**Conversion loop** (commands in `.claude/commands/`):

```
/preflight        MCP (strapi, next-devtools, playwright) + node + build + lint + kit
/project-setup <export>   ONCE:
   Phase 0  INTAKE interview → .claude/PROJECT-PLAN.md
            (sitemap · Strapi content model · infra readiness) — foundation-first
   Phase 0b create planned Strapi content types (via strapi MCP)
   Phase 1  brand foundation: tokens (from tokens/) · fonts · global CSS · Tier-1 · MOTION KIT
─ per page/section ─
/criteria <page>/<section>   read pages/ + motion spec → build spec (+ reuse & motion map) → you approve
/build-component <page>/<section>   compose from kit → GATE (QUALITY-BAR) → register → stop
/commit                      small local commits, never push
```

- **Foundation-first:** the data (Strapi content types) and servers (Strapi + staging) a page needs must be
  ready **before** that page is built. `/criteria` + `/build-component` wait until `PROJECT-PLAN.md`'s infra
  checklist is green.

- **Exports go in `design-input/<export>/`** (git-ignored). **`tokens/` + `art-direction.md` are the source of
  truth**; if the HTML disagrees, follow them. (Older flat exports: fall back to `design.md`.)
- **NEVER reference `design-input/` from committed code** — it's git-ignored and excluded from the deploy
  package. Copy/optimize assets into `frontend/public/`; read design files only at authoring time.
- **Motion:** Motion (`motion/react`) + Lenis, via our reusable primitives — see the **`motion-standards`** skill
  (fail-safe reveals, Lenis-aware nav, parallax coverage, reduced-motion). Never re-roll motion per section.
- **The gate:** every build must pass **`.claude/QUALITY-BAR.md`** (machine checks @ 4 breakpoints + conformance
  to the art direction + a taste audit). "Done" = gate green + your sign-off.
- Reuse skills: **`ponytail`** / **`ponytail-review`** (simplest, no duplication) and **`caveman`** (terse prose /
  compress memory). Component/CSS rules: **`nextjs-component-standards`**. All live in `.claude/skills/`.

## Strapi (Backend)

- `backend/dist/` is generated output — clean before build via `dev:backend:clean` or `scripts/clean-generated.js`.
- Check for duplicate `collectionName` values in content type configs before building.
- Never write unconditional seed scripts that run on every boot.
- Never commit `.tmp/data.db` or `backend/public/uploads/` — use Strapi Transfer for content migration.

## Content & Copy

Never invent UI copy, labels, placeholder content, or answers. If content is missing from the task, ask.

## Git Workflow

Branches: `main` (protected), `feature/<name>`, `fix/<description>`, `chore/<description>`. Never push directly to `main`.

One commit per completed task. Imperative subject line (e.g. `Add hero section to landing page`).

QA gate before committing: successful `npm run build` + manual viewport check at 320 / 768 / 1024 / 1440 px.

## Do Not Edit

- `.cursor/**` — Cursor IDE rules
- `.agents/**` — vendored skill content (context7, figma, ui-ux-pro-max, agentic-team)
- `backend/dist/` — generated Strapi output
