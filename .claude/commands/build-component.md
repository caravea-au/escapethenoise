---
description: Build an APPROVED /criteria spec into Next.js components — reuse-first, Tailwind, light gate, then register + STOP. Never pushes.
argument-hint: <page>/<section>   e.g. /build-component home/hero
---

Build the components for **one approved spec**, reusing what exists, then stop. Follow the
**`nextjs-component-standards`** skill throughout (it owns the how). **Never push.**

Input: `$ARGUMENTS` = `<page>/<section>`. Read its spec from `.claude/specs/<page>/<section>.md`.
If the spec isn't ✅ APPROVED, STOP — run `/criteria` first.

## 1. Reuse check FIRST (before writing anything)
Read `.claude/COMPONENTS.md` and grep `frontend/src/components/`. Honour the spec's REUSE MAP:
**reuse / extend** existing components; build **new** only for elements marked NEW. (ponytail rung #2 —
re-implementing what exists is the failure mode we're preventing.)

## 2. Build (Tailwind-first, tokens, no clamp)
Per `nextjs-component-standards`:
- Tier-1 from `components/ui/`; create Tier-2 in its own folder; keep Tier-3 inline in the route.
- Tailwind utilities first; custom CSS only where Tailwind can't reach. **No `clamp()`** — breakpoint steps.
- **Theme tokens only**, never raw hex. Server Component by default; `'use client'` only for the stateful leaves the spec named.
- `next/image` + **WebP**: pre-convert assets with `npm run optimize:image -- <src> <destUnderPublic> [--mobile]`
  into `public/` (≤200 KB desktop / ≤100 KB mobile). **Never reference `design-input/` at runtime** — `public/` only.
- a11y: semantic HTML, focus-visible rust ring, real `alt`, honour `prefers-reduced-motion`.
- **Content:** use the copy/assets from the spec; Strapi-driven fields wired as props/fetch. Never invent copy — if a string is missing, stop and ask.

## 3. ponytail-review pass
Run the **ponytail-review** skill on the new code. Cut duplication, re-rolled stdlib, speculative
abstraction, dead flexibility **before** the gate. Aim: the shortest diff that matches the design.

## 4. Light gate (the agreed "done" bar)
- `npm run build` → must compile. `npm run lint` → must pass. **If `next lint` errors** (Next 16 removed it),
  fall back to the ESLint CLI (`npx eslint frontend/src --ext .ts,.tsx`) and note it.
- `ponytail-review` → no duplicated/rebuilt component.
- **Viewport check at 320 / 768 / 1024 / 1440 px** via the **Playwright MCP**: resize to each width, screenshot
  the section, and compare against the design (the exported HTML rendered, or `design.md`). Report each
  breakpoint ✅/⚠️ with what differs. (Playwright MCP must be loaded — `/preflight` confirms it; if it isn't,
  fall back to a human checklist and say so. Don't claim visual parity Claude didn't verify.)
- Green → continue. Red → fix and re-run (≤3 tries); still red → write a short failure note and stop.

## 5. Register + report
Append every new Tier-1/Tier-2 component to `.claude/COMPONENTS.md`
(`Name | tier | purpose | path | key props | used-on`). Update `used-on` for reused ones.
Report: components reused, components created (+ registry rows), gate results per breakpoint, any open
content questions. **Stop — do not commit or push.** Commit via `/commit` when the user is happy.
