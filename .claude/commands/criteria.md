---
description: Draft the build spec for ONE page or section from the design export, with a reuse map. Self-reviews, then YOU approve. Writes no code.
argument-hint: <page>/<section> [export-folder] [--deep]   e.g. /criteria home/hero your-export
---

Write a **fidelity spec** for ONE page/section so it can be built right the first time. **No code.**
Read the design, map what to **reuse vs build new**, define what "done" looks like, self-check, then
hand it to the user to approve.

> **Delegation:** capture the design reference once (export: `art-direction.md` + `tokens/` + the section's HTML; or the Figma node), then invoke `frontend-architect` and `backend-architect` **in parallel** (read-only) with that reference pasted into each prompt, default model Sonnet; on `--deep`, invoke them with an Opus model override for complex pages. Consolidate their blueprints into the spec below. Backend architect only if the section needs Strapi data.

Input: `$ARGUMENTS` = `<page>/<section>` + optional export folder (default: the single export, else ask).

## 1. Read the design (tokens + art-direction win)
- Read, for this page: `design-input/<export>/pages/<page>/<page>.html` (this section's marked block),
  `pages/<page>/<page>.motion.md` (the **motion spec**), plus `art-direction.md`, `tokens/`, and
  `content/<page>.content.md`. Open just-in-time; don't dump whole files — pull only this section.
- Where the HTML disagrees with `tokens/` / `art-direction.md`, **follow the tokens / art-direction** and note it.
- Older flat export? Fall back to `design.md` + the single HTML and note it.

## 2. Build the spec (the template below)
- **Section breakdown:** the visual elements, in order.
- **REUSE MAP (the core):** for each element, check `.claude/COMPONENTS.md` + `frontend/src/components/`.
  Mark each as **REUSE `<Component>`**, **EXTEND `<Component>`**, or **NEW (Tier 2/3)**. Building something
  the registry already has is a hard reject — that's the duplication this kit prevents.
- **Content source:** which copy/images are static vs **Strapi**-driven (flag CMS fields). Never invent copy
  (`CLAUDE.md`): if copy is missing from the export, list it as a question.
- **MOTION (from `<page>.motion.md`):** for each element, the intent → the kit primitive that implements it
  (hero mask-reveal / fade-up / scroll-text-reveal / parallax / marquee / nav transparent→solid). Per the
  `motion-standards` skill. If the spec has no motion for a section, say "none".
- **Responsive:** breakpoint behaviour as steps (no clamp). Note layout shifts at 320 / 768 / 1024 / 1440.
- **Interactions:** anything stateful (modal, filter, map pin, carousel) → needs `'use client'`; describe the behaviour.
- **Acceptance = visual fidelity** at the 4 breakpoints + the motion intent + a11y (semantic, focus, alt) + `prefers-reduced-motion`.

## 3. Light self-review (3 quick passes — not a committee)
- **Faithful?** matches `tokens/` + `art-direction.md` (colours, type, spacing, motion) at all breakpoints.
- **Reuse?** every reusable element routed to an existing component; nothing rebuilt that exists.
- **Simple?** run the **ponytail** lens — no speculative components, no abstraction a single section doesn't need.

Fix anything the passes flag, in place. The spec is not ready until all three clear.

## 4. Save + hand off
Save to `.claude/specs/<page>/<section>.md`. Show the user the **plain-English summary + the reuse map**
and ask for approval. Write **no code** until approved. Only ask the user about genuine **content/brand**
gaps (missing copy, an undocumented brand decision) — never about how to slice or structure the build.

```
SECTION: <page>/<section>          Export: <folder>

WHAT YOU'LL SEE        <1–2 plain sentences>
ELEMENTS              <ordered list>
REUSE MAP
  • <element> → REUSE <Component> | EXTEND <Component> | NEW (Tier 2 <Name> / Tier 3 inline)
CONTENT               static: <…>   ·   Strapi: <fields>   ·   ❓missing copy: <…>
MOTION                <element → primitive> (e.g. headline → MaskReveal load) | none
RESPONSIVE            320 / 768 / 1024 / 1440 → <behaviour, breakpoint steps, no clamp>
INTERACTIONS          <stateful bits → 'use client'> | none (static)
ACCEPTANCE            fidelity @ 4 breakpoints · motion intent · a11y · reduced-motion
✅ APPROVED: ☐        ← ticked by the user
```
