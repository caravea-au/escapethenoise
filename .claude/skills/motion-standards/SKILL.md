---
name: motion-standards
description: >
  How to implement premium scroll motion in this Next.js project (Motion + Lenis) so it is
  reliable, accessible, and never leaves content blank. Use whenever adding scroll reveals,
  parallax, smooth-scroll, headline mask-reveals, scroll-linked text, or a scroll-reactive nav
  — invoked by /build-component. Encodes the fail-safe patterns we debugged the hard way.
---

# Motion Standards

Stack: **Motion** (`motion/react`) for animation + **Lenis** for smooth-scroll. Build reusable
primitives; never re-roll motion per section. Every rule below fixes a real bug we hit.

## The non-negotiables (each one prevents a shipped failure)

1. **Reveals must be FAIL-SAFE — content can never stay hidden.**
   - Trigger with **`useInView` on the element's own stable ref**, NOT `whileInView`
     (`whileInView` gets skipped on fast/jumpy scroll → blank sections).
   - Add a **failsafe timer** (~2.5s): if the observer never fires, reveal anyway.
   - `show = reduce || inView || failsafe`.

2. **Scroll-reactive UI (e.g. nav) must read LENIS, not the window.**
   - Use **`useLenis((lenis) => …lenis.scroll…)`**. `window` scroll events and Motion's
     `useScroll` are both bypassed by Lenis and won't fire reliably.

3. **No hydration mismatch.** Never render a different tree on server vs first client render.
   - Put the observed ref on a **stable, block-level** element that renders on every pass
     (an inline `<span>` gives IntersectionObserver a broken box — use `block`).

4. **Respect `prefers-reduced-motion` everywhere.** Reduced-motion users get the content
   immediately and statically. Wire it globally via `<MotionConfig reducedMotion="user">`.

5. **Parallax images must OVER-cover their travel.** Scale the image so its overflow margin
   on each side exceeds the parallax distance (e.g. `scale-[1.3]` + `distance ≤ 50`), and give
   the section a solid fallback background — otherwise a gray edge strip shows.

6. **Text over media is ALWAYS light-on-dark with a scrim.** Never place dark text on a
   video/photo. Add a gradient scrim; verify readability.

7. **Animate `transform` and `opacity` only** (GPU-friendly). Keep active scroll triggers
   modest (< ~30). Never animate layout-affecting properties on scroll.

## The kit primitives (build once, reuse)

| Primitive | Effect | Trigger |
|---|---|---|
| `SmoothScroll` | Lenis momentum + `MotionConfig reducedMotion="user"` | root provider |
| `Reveal` | fade + lift | useInView + failsafe |
| `MaskReveal` | headline lines rise from a clip mask | `mode="load"` (hero) / `"view"` |
| `Marquee` | infinite logo strip, hover-pause | CSS keyframe (no JS) |
| `Parallax` | image drift on scroll | `useScroll` + `useTransform` |
| `ScrollTextReveal` | words brighten/fade in tied to scroll | `useScroll` progress |
| `Typewriter` | characters type out (accent only, sparing) | on view / on load |
| `ImageReveal` | blur/clip/scale-in on scroll | useInView + failsafe |

## Applying motion (from the export's `<page>.motion.md`)

- Read the per-section motion spec; map each intent to a primitive above.
- Hero headline → `MaskReveal mode="load"`; below-fold headings → `MaskReveal mode="view"`.
- Section bodies/cards → `Reveal` (stagger via `delay`).
- Full-bleed imagery → `Parallax` (over-covered) + scrim.
- Nav over a media hero → transparent → solid via `useLenis`.
- Keep it purposeful: one signature moment per page, quiet elsewhere.

## Verify (before the gate passes)

- Playwright at 320/768/1024/1440: **0 blank sections**, **0 hydration errors**, reveals
  settle, parallax leaves no edge strip, text readable over media.
- Toggle reduced-motion: content still fully visible, no movement.
