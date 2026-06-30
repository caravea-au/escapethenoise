# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

npm workspaces monorepo:
- `frontend/` — Next.js 15.3, React 19, TypeScript 5.8, Tailwind CSS 4
- `backend/` — Strapi 5.40.0 CMS, SQLite (`better-sqlite3`)
- `app.js` — production Node.js HTTP wrapper around Next.js (reads `PORT`, binds `0.0.0.0`, serves from `frontend/`)

## Commands

All commands run from the repo root unless noted.

```bash
npm run dev              # Next.js dev server
npm run dev:backend      # Strapi dev server
npm run dev:backend:clean  # clean generated output, then Strapi dev
npm run build            # Next.js production build
npm run build:backend    # Strapi production build
npm run lint             # ESLint via next lint
npm start                # production server (node app.js)
```

Stop dev servers after completing a task — do not leave them running.

If `better-sqlite3` throws `NODE_MODULE_VERSION` errors, run `npm rebuild better-sqlite3` from `backend/`. Prefer Node 20 or 22 (engine range: >=20 <=24).

## Frontend Structure

```
frontend/src/app/          ← Next.js App Router route files
frontend/src/styles/       ← tokens.css + global CSS
frontend/src/lib/fonts.ts
frontend/src/pages/_error.tsx  ← Next.js compat shim
frontend/public/           ← static assets
```

Do not introduce `src/components/` until genuine reuse exists across routes. Component files follow `Component.tsx` + `Component.module.css` naming.

## CSS & Layout Rules

- **No `clamp()`** for responsive sizing — use explicit `px` values with media queries at standard breakpoints.
- **Sizing/spacing in `px`**, not `rem`/`em`.
- Layout priority: document flow → flexbox → CSS grid → `position: absolute` (last resort, only for overlays, badges, decorative elements that cannot participate in flow).
- Images: WebP format, ≤200 KB desktop / ≤100 KB mobile.

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
