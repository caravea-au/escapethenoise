# Quality Bar — the definition of "premium" the gate enforces

Every page must pass this before it is "done". It has two kinds of checks:
**machine** (deterministic, can't be fudged) and **conformance/taste** (checked against the
approved `art-direction.md`, not against opinion). This is what makes the premium floor reliable.

---

## A. Machine checks (deterministic — run by /build-component)

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] **jscpd** (or equivalent) finds no duplicated/rebuilt component
- [ ] **Playwright @ 320 / 768 / 1024 / 1440**:
  - [ ] 0 sections with near-zero height (no blank sections)
  - [ ] 0 React hydration errors in the console
  - [ ] scroll reveals settle to their final state (measured, not eyeballed)
  - [ ] parallax images leave no uncovered edge strip
  - [ ] text over media is readable (light-on-dark + scrim present)
  - [ ] no horizontal overflow / no element wider than the viewport
- [ ] `prefers-reduced-motion` on → content fully visible, motion disabled
- [ ] Images: `next/image`, WebP, ≤200 KB desktop / ≤100 KB mobile
- [ ] No raw hex in components (tokens only); nothing references `design-input/` at runtime

## B. Conformance checks (against the approved art-direction.md)

- [ ] Colours, type scale, spacing, radii match the **tokens** exactly
- [ ] Fonts match; the serif accent is used **sparingly** (per spec, not everywhere)
- [ ] The section's **motion intent** (from `<page>.motion.md`) is implemented
- [ ] The hero treatment matches the spec (video/image/flat + parallax as specified)
- [ ] Banned decoration absent (no decorative gradients, no type drop-shadows, ≤2 accents,
      no centered body copy) — per the art direction
- [ ] Reuse map honoured — existing components reused, nothing rebuilt

## C. Taste audit (structured, not vibes)

Run the **frontend-design** skill (or taste-skill audit) against the screenshots and ask,
concretely:
- [ ] Does it read **distinctive**, or could it be any templated SaaS site? (must be distinctive)
- [ ] Is there a clear **type hierarchy** and a **signature moment**?
- [ ] Is whitespace intentional, or is anything cramped / a dead void?
- [ ] Is motion **purposeful**, or gratuitous?
- [ ] Fix what it flags **before** calling the build done.

## D. Human sign-off

- [ ] You reviewed the running page at the breakpoints and approve.

---

> A build is **not "done"** until A + B + C pass and D is given. The machine checks catch the
> failures we hit before (blank sections, gray parallax strip, one-note type); the conformance
> checks keep it on-brand; the audit keeps it distinctive.
