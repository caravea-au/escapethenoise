---
description: Build an APPROVED /criteria spec into Next.js components — reuse-first, compose from the kit, pass the full QUALITY-BAR gate, register + STOP. Never pushes.
argument-hint: <page>/<section>   e.g. /build-component home/hero
---

Build the components for **one approved spec**, reusing what exists, then stop. Follow the
**`nextjs-component-standards`** skill (structure/CSS) and the **`motion-standards`** skill (all motion)
throughout. **Compose from the kit — don't re-roll motion or hand-draw premium.** **Never push.**

Input: `$ARGUMENTS` = `<page>/<section>`. Read its spec from `.claude/specs/<page>/<section>.md`.
If the spec isn't ✅ APPROVED, STOP — run `/criteria` first.

## 0. Foundation-first pre-check (STOP if not ready)
Before writing code, confirm in `.claude/PROJECT-PLAN.md`: this page is in the sitemap, its **Strapi content
type(s) exist** (verify via the `strapi` MCP), and the **infra checklist is green**. If a dependency is
missing, STOP and say what's blocking — never build a page whose data/servers aren't ready.

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
- **MOTION (per the spec's MOTION line + `motion-standards`):** compose the kit primitives — `MaskReveal`
  (headlines), `Reveal` (sections/cards), `Parallax` (imagery, over-covered), `Marquee`, `ScrollTextReveal`,
  nav transparent→solid via `useLenis`. All fail-safe (never blank), reduced-motion aware, text-over-media
  scrimmed. Don't invent new motion — extend the kit if a genuinely new effect is needed.
- **Content:** use the copy/assets from the spec; Strapi-driven fields wired as props/fetch. Never invent copy — if a string is missing, stop and ask.

## 3. ponytail-review pass
Run the **ponytail-review** skill on the new code. Cut duplication, re-rolled stdlib, speculative
abstraction, dead flexibility **before** the gate. Aim: the shortest diff that matches the design.

## 4. The gate — must pass `.claude/QUALITY-BAR.md` (not "light" anymore)
Run the full bar; a build is **not done** until A + B + C pass.
- **A. Machine (deterministic):** `npm run build` + `npm run lint` pass · **`ponytail-review`** → no
  duplication (jscpd optional — not installed by default) · **Playwright @ 320/768/1024/1440** measuring (not eyeballing): **0 blank sections, 0 hydration
  errors**, reveals settle, **parallax leaves no edge strip**, text-over-media readable, no horizontal overflow ·
  reduced-motion → content visible + motion off · image budgets · tokens-only / no `design-input/` refs.
  (Playwright MCP must be loaded — `/preflight` confirms; if absent, say so and hand a human checklist.)
- **B. Conformance (vs `art-direction.md` + tokens):** colours/type/spacing/radii match tokens; serif accent
  sparing; the section's **motion intent implemented**; hero treatment matches; banned decoration absent; reuse honoured.
- **C. Taste audit:** run **`frontend-design`** (or taste-skill) on the screenshots — distinctive not templated?
  clear hierarchy + a signature moment? whitespace intentional (no dead voids/crowding)? motion purposeful?
  Nav with 3+ links collapses to a menu (never `flex-wrap`). Fix what it flags.
- Green → continue. Red → fix and re-run (≤3 tries); still red → short failure note and stop.

## 5. Register + report
Append every new Tier-1/Tier-2 component to `.claude/COMPONENTS.md`
(`Name | tier | purpose | path | key props | used-on`). Update `used-on` for reused ones.
Report: components reused, components created (+ registry rows), gate results per breakpoint, any open
content questions. **Stop — do not commit or push.** Commit via `/commit` when the user is happy.
