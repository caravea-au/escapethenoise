# Repository Guidelines

## Project Structure

This repository is an npm workspaces monorepo: `frontend/` (Next.js) and `backend/` (Strapi 5). Root `package.json` owns shared scripts; each workspace has its own `package.json`. Shared project docs live in `docs/`.

## Frontend Conventions

- **Routing:** Route entry files live in `frontend/src/app/`.
- **Components:** Reintroduce `frontend/src/components/` only when the project actually needs reusable or route-specific components. Use one folder per persistent component with `Component.tsx` and `Component.module.css`.
- **Styling:** Global tokens and page-supporting CSS live in `frontend/src/styles/`. Use `px` for authored spacing, sizing, offsets, radii, font sizes, and breakpoint values. Do not use CSS `clamp()` for responsive sizing; use explicit breakpoints or responsive utilities.
- **Layout:** Prefer document flow with flex, then grid, before `position: absolute`. Reserve absolute positioning for overlays, badges, and controlled effects.
- **Assets:** Static assets live in `frontend/public/`. Optimize committed images to WebP where practical, targeting <=200 KB for desktop images and <=100 KB for mobile images unless quality requirements justify an exception.

## Commands

Run from the repository root.

| Action | Command |
| --- | --- |
| Frontend dev | `npm run dev` |
| Backend dev | `npm run dev:backend` |
| Backend clean dev | `npm run dev:backend:clean` |
| Frontend build | `npm run build` |
| Backend build | `npm run build:backend` |
| Production start | `npm start` |
| Lint | `npm run lint` |

## QA Gates

No formal automated test suite is committed yet. Before handing off work, run the build gates that match the touched area:

- Frontend or shared docs that describe frontend behavior: `npm run build`
- Backend, Strapi schema, seed, or CMS workflow changes: `npm run build:backend`
- Visual or route changes: manually verify the affected route at 320px, 768px, 1024px, and 1440px

Stop any local frontend or backend dev servers started for the task unless the user explicitly asks to keep them running.

## Strapi Content Safety

Live Strapi content is runtime data, not Git-owned source code. Follow `.cursor/rules/strapi-content-safety.mdc`.

- This baseplate intentionally carries no project-specific content types or seed routine.
- Do not add content seeds that run unconditionally in production.
- If a future project adds seed behavior, keep production `backend/.env` with seed mode disabled unless a deliberate one-time bootstrap is being run.
- For new CMS-backed pages, seed only missing bootstrap content and prefer create-if-missing behavior over overwriting existing records.
- To migrate local CMS content to live, use Strapi transfer after backing up the remote database; do not rely on Git push or deploy as content sync.
- Follow `docs/STRAPI-CONTENT-MIGRATION.md` before adding backend seed utilities or changing remote seed settings.

## Generated Output Safety

- Treat `backend/.tmp/data.db`, `backend/public/uploads/`, `backend/dist/`, `.next/`, caches, and other generated output as runtime or build artifacts.
- Do not commit `backend/.tmp/data.db` or `backend/public/uploads/` content, except `backend/public/uploads/.gitkeep`.
- After backend changes, run `npm run build:backend` and check for stale generated `backend/dist/` output before handoff.

## Cursor Rules

Cursor `.mdc` rules under `.cursor/rules/` are the authoritative source for agent workflow guardrails, including Strapi content safety, generated-output handling, image optimization, no content guessing, local runtime cleanup, commit checkpoint discipline, no `clamp()` responsive sizing, and minimal absolute positioning.

## Contributor Notes

- Do not edit `.cursor/**`, `.agents/**`, `__pycache__/`, generated output, or vendored skill content unless the task specifically targets those files.
- Do not guess brand copy, product facts, routes, CMS content, or imagery. Use confirmed docs, Figma, live site references, or ask for clarification.
- Keep PRs focused, describe behavioral changes, and include screenshots for UI changes when useful.
