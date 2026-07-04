---
name: nextjs-component-standards
description: >
  How to build a Next.js (App Router) component in this baseplate from a Claude
  Tailwind design export. Enforces reuse-before-writing, Tailwind-first styling, NO
  clamp(), design-token-only colours, server/client discipline, accessibility, and
  registering every new component. Use whenever writing, refactoring, or extracting a
  React/Next component here — invoked by /build-component and applicable on any component task.
---

# Next.js Component Standards (this baseplate)

The stack: Next.js 15 App Router · React 19 · TypeScript · **Tailwind CSS 4**. Source of
truth for look is `design.md` in the relevant `design-input/<export>/` folder. **design.md
wins** over the exported HTML whenever they disagree.

Pair with **ponytail** (reuse/simplest) and **caveman** (terse prose). This skill governs the
build; those govern the diff and the talk.

## 0. Reuse BEFORE you write (non-negotiable — ponytail rung #2)

Before creating ANY component:
1. Read `.claude/COMPONENTS.md` (the registry).
2. Grep `frontend/src/components/` for a name/purpose match.
3. If something covers it → **reuse or extend it**, don't rebuild. Re-implementing what already
   lives a few files over is the #1 source of inconsistency this kit exists to prevent.
4. Only build new if nothing matches. Then you MUST register it (§6).

## 1. The three tiers (decides WHERE the code goes)

| Tier | What | When to create | Location |
|---|---|---|---|
| **1 — Global primitive** | Button, Link, Input, Container, Section, Heading/Text | at `/project-setup`, day one | `frontend/src/components/ui/` |
| **2 — Shared pattern** | Card, Navbar, Footer, Accordion, LogoRail… | the **first** time a section needs it | `frontend/src/components/<Name>/` |
| **3 — One-off** | markup unique to a single section | keep **inline** in the page/section until it repeats | the route file |

Don't pre-build Tier-2/3 abstractions. A Tier-3 block graduates to Tier-2 only when a **second**
section needs it.

## 2. Styling — Tailwind-first, no clamp()

- **Tailwind utilities first.** Drop to custom CSS (a `Component.module.css`, `@layer`, or
  arbitrary value) **only** when Tailwind can't express it (complex keyframes, exotic selectors).
- **NO `clamp()`.** It misbehaves on iOS/Safari. Do responsive sizing with **breakpoint steps**:
  `text-[40px] md:text-[60px] lg:text-[78px]`, not `text-[clamp(40px,6.6vw,78px)]`.
- **Tokens only — never raw hex.** Use the theme tokens from `/project-setup`
  (`text-accent`, `bg-surface`, `border-line`). If a colour isn't a token yet, add it to the Tailwind
  theme first, then use the token. Raw `#hex` in markup is a bug.
- Spacing/layout: flex/grid with `gap` — never margin-based inline spacing (per `design.md` §5).
- Honour `prefers-reduced-motion` on every animation.

## 3. Server vs Client components

- **Server Component by default** (no directive). Most marketing markup is static — keep it server.
- Add `'use client'` **only** when the component needs state, effects, event handlers, or browser
  APIs (modals, filters, map pins, carousels). Push `'use client'` to the smallest leaf, not the page.

## 4. File & prop conventions

- `Component.tsx` (+ `Component.module.css` **only if** §2 forced custom CSS).
- Typed props, minimal surface. No prop nobody passes. No config for a value that never changes (ponytail).
- Co-locate a Tier-2 component's files in its own folder: `components/Card/Card.tsx`.

## 5. Accessibility & assets

- Semantic HTML (`<button>`, `<nav>`, `<h1-3>` in order). Visible focus ring (`focus-visible`, the accent token).
- Images via `next/image`. **Pre-convert** each source asset to WebP under budget with
  `npm run optimize:image -- <src> <destUnderPublic> [--mobile]` (sharp; ≤200 KB desktop / ≤100 KB mobile),
  then reference the `public/` output.
- **NEVER reference `design-input/` from component code** — it's git-ignored and excluded from the deploy
  package, so any `import` / `src` / `url()` into it breaks build & deploy. Reference `public/` only.
- Real `alt` text. Decorative imagery sits under a dark scrim so text stays legible.

> **Tokens live in Tailwind v4 `@theme {}` in `frontend/src/styles/tokens.css`** (no `tailwind.config.js`).
> Use the token utilities (`bg-surface`, `text-accent`); add a new token to `@theme` before using a new colour.

## 6. Register what you build (closes the reuse loop)

After creating a Tier-1 or Tier-2 component, append a row to `.claude/COMPONENTS.md`:
`| Name | tier | purpose | path | key props | used-on |`. An unregistered shared component is
**unfinished** — the next session can't reuse what isn't listed.

## 7. Done checklist (the light gate, run by /build-component)

- [ ] Reuse check done (registry + grep) before writing
- [ ] Tailwind-first, no `clamp()`, tokens not hex
- [ ] `'use client'` only where genuinely needed
- [ ] a11y: semantic, focus ring, alt text, reduced-motion
- [ ] assets optimized into `public/` (WebP, size budget)
- [ ] `npm run build` ✅ and `npm run lint` ✅
- [ ] `ponytail-review` pass — no duplication / over-engineering
- [ ] new components added to `COMPONENTS.md`
- [ ] manual viewport check at 320 / 768 / 1024 / 1440 px matches the design
