---
description: Build an APPROVED /criteria spec into Next.js components — reuse-first, compose from the kit, pass the full QUALITY-BAR gate, register + STOP. Never pushes.
argument-hint: <page>/<section> [--solo] [--deep]   e.g. /build-component home/hero
---

Build the components for **one approved spec**, reusing what exists, then stop. Follow the
**`nextjs-component-standards`** skill (structure/CSS) and the **`motion-standards`** skill (all motion)
throughout. **Compose from the kit — don't re-roll motion or hand-draw premium.** **Never push.**

Input: `$ARGUMENTS` = `<page>/<section>`. Read its spec from `.claude/specs/<page>/<section>.md`.
If the spec isn't ✅ APPROVED, STOP — run `/criteria` first.

## 0. Foundation-first pre-check (STOP if not ready)
Before writing code, confirm in `.claude/PROJECT-PLAN.md`: this page is in the sitemap, its **Strapi content
type(s) exist** (verify via the `strapi` MCP), and the **infra checklist is green**. Also confirm the
section's **content is seeded in local Strapi** — the spec's CONTENT rows resolve to real entries/fields
(incl. SEO + any collection entries). If it isn't seeded, run **`/seed <page|collection>`** first. If a
dependency is missing, STOP and say what's blocking — never build a page whose data/servers aren't ready,
and **never hardcode content to work around an empty Strapi**.

## 1. Reuse check FIRST (before writing anything)
> **Delegation & modes:** default = delegate the build to `frontend-developer` (and `backend-developer` if the spec wires Strapi data), sequentially. After the build, run the **light QA panel** — `design-fidelity-qa` + `functional-qa` in parallel (read-only) — then the fix loop (§4b). `--solo` skips all subagents and builds inline (use for trivial sections). `--deep` escalates the QA/verify reviewers to the Opus tier (more thorough, higher cost).

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
- a11y: semantic HTML, a visible focus ring (accent token), real `alt`, honour `prefers-reduced-motion`.
- **MOTION (per the spec's MOTION line + `motion-standards`):** compose the kit primitives — `MaskReveal`
  (headlines), `Reveal` (sections/cards), `Parallax` (imagery, over-covered), `Marquee`, `ScrollTextReveal`,
  nav transparent→solid via `useLenis`. All fail-safe (never blank), reduced-motion aware, text-over-media
  scrimmed. Don't invent new motion — extend the kit if a genuinely new effect is needed.
- **Content (Strapi-driven — no hardcoding):** fetch every content value from Strapi — text, headings,
  rich text, CTA labels+targets, content images (Strapi Media via `next/image`), SEO (via the `seo`
  component, read in `generateMetadata`), and collection entries + relations. **No hardcoded editorial
  copy, image paths, or SEO strings, and no hardcoded fallback defaults.** A missing/empty field renders
  a proper **empty/error state** (that state's microcopy lives in code) — never a default string. Only
  the spec's CODE-ONLY row stays inline (form fields, routing, system microcopy, empty-state copy). Never
  invent copy — if content is missing from Strapi/the export, stop and ask; don't inline it.

## 3. ponytail-review pass
Run the **ponytail-review** skill on the new code. Cut duplication, re-rolled stdlib, speculative
abstraction, dead flexibility **before** the gate. Aim: the shortest diff that matches the design.

## 4. The gate — must pass `.claude/QUALITY-BAR.md` (not "light" anymore)
Run the full bar; a build is **not done** until A + B + C pass.
- **A. Machine (deterministic):** `npm run build` + `npm run lint` pass · **`ponytail-review`** → no
  duplication (jscpd optional — not installed by default) · **Playwright @ 320/768/1024/1440** measuring (not eyeballing): **0 blank sections, 0 hydration
  errors**, reveals settle, **parallax leaves no edge strip**, text-over-media readable, no horizontal overflow ·
  reduced-motion → content visible + motion off · image budgets · tokens-only / no `design-input/` refs ·
  **content provenance**: grep the component — no hardcoded editorial copy / image paths / SEO strings and
  no hardcoded fallback defaults; every content value fetched from Strapi; collection lists render from
  Strapi entries (not an inline array); missing field → empty/error state.
  (Playwright MCP must be loaded — `/preflight` confirms; if absent, say so and hand a human checklist.)
- **B. Conformance (vs `art-direction.md` + tokens):** colours/type/spacing/radii match tokens; serif accent
  sparing; the section's **motion intent implemented**; hero treatment matches; banned decoration absent; reuse honoured.
- **C. Taste audit:** run the **`design-taste-frontend`** skill on the screenshots — distinctive not templated?
  clear hierarchy + a signature moment? whitespace intentional (no dead voids/crowding)? motion purposeful?
  Nav with 3+ links collapses to a menu (never `flex-wrap`). Fix what it flags.
- Green → continue. Red → fix and re-run (≤3 tries); still red → short failure note and stop.

## 4b. Fix loop (auto-fix to green)
For each **P0/P1** finding from the light QA panel, dispatch a fix to the responsible developer
(design / motion / a11y / frontend-perf / visual → `frontend-developer`; API / data / Strapi / integration
/ backend-perf → `backend-developer`; **content-provenance** → `frontend-developer` to rewire a hardcoded
value to a Strapi fetch, or `backend-developer` / `/seed` when the content is simply missing from Strapi;
security findings → route to the developer (FE or BE) who owns the affected file), then re-run **only the
affected** QA agent. Repeat until 0 P0/P1 or
**3 rounds**, then stop. **P2/P3** → list as optional polish, do not auto-fix. Print a cost line:
`≈tokens · rounds used · P0/P1 fixed · P2/P3 deferred`.

## 5. Register + report
Append every new Tier-1/Tier-2 component to `.claude/COMPONENTS.md`
(`Name | tier | purpose | path | key props | used-on`). Update `used-on` for reused ones.
Report: components reused, components created (+ registry rows), gate results per breakpoint, any open
content questions. **Stop — do not commit or push.** Commit via `/commit` when the user is happy.
