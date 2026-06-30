---
name: frontend-design
description: >-
  Builds distinctive, production-grade UIs that avoid generic AI aesthetics.
  Guides bold aesthetic direction, typography, color, motion, layout, and
  atmosphere. Use when designing or implementing components, pages, landing
  sites, marketing UI, dashboards, or any frontend where visual character and
  craft matter; when the user asks for memorable, non-generic, or polished
  interfaces; or when rejecting clichéd fonts, purple gradients, and cookie-cutter layouts.
---

# Frontend design (distinctive UI)

**Scope:** Repository skill—lives under `.cursor/skills/` in this repo only; see [../README.md](../README.md).

Adapted from [anthropics/skills: frontend-design](https://github.com/anthropics/skills). Apply when building or refining interfaces where **intentional aesthetics** matter as much as function.

## Before coding: commit to a direction

Answer briefly, then **pick one strong lane** and execute it consistently:

| Lens | Questions |
|------|-----------|
| Purpose | What problem does this solve? Who uses it? |
| Tone | Brutally minimal, maximalist, retro-futuristic, organic, luxury, playful, editorial, brutalist, art deco, soft pastel, industrial, etc. |
| Constraints | Framework, performance budget, accessibility (WCAG), SSR/CSR, design system boundaries. |
| Differentiation | What is the **one** memorable thing—typography, motion, color story, layout, texture? |

**Rule:** Bold maximalism and refined minimalism both work. **Intentionality** beats intensity. Do not default to a safe middle.

## Implementation pillars

1. **Typography** — Pair a distinctive display face with a refined body face. Avoid overused neutrals (Inter, Roboto, Arial, generic system stacks). Prefer characterful, context-appropriate choices.
2. **Color & theme** — One dominant palette with sharp accents beats timid, evenly weighted color. Use CSS variables for tokens; keep hierarchy obvious.
3. **Motion** — Prefer CSS for static/HTML; in React, use Motion when available. Prefer **one orchestrated moment** (e.g. staggered load-in with `animation-delay`) over scattered noise. Add surprising hover or scroll affordances where they reinforce the concept.
4. **Spatial composition** — Favor asymmetry, overlap, diagonal flow, grid-breaking, or deliberate density vs. generous whitespace—**not** the same centered hero every time.
5. **Backgrounds & depth** — Gradient meshes, grain/noise, geometric patterns, layered transparency, strong shadows, decorative borders, or purposeful texture—match the aesthetic; avoid flat gray slabs when the concept calls for atmosphere.

**Match complexity to vision:** maximalist ideas need richer animation and layering; minimal/refined ideas need spacing, type rhythm, and micro-detail—not more components.

## Anti-patterns (explicitly avoid)

- Generic “AI slop”: purple-on-white gradients, predictable card grids, interchangeable hero sections.
- Clichéd font picks and **converging** on the same trendy face across unrelated work.
- Decoration without concept (motion/texture that does not support tone or hierarchy).
- Accessibility regressions: respect contrast, focus states, reduced motion, and semantic structure even when pushing visuals.

## Workflow

1. State aesthetic direction in one short paragraph (tone + differentiation).
2. Define CSS variables (color, type scale, radius, shadow, motion).
3. Build structure, then layer motion and texture last so they serve hierarchy.
4. Self-check: “Would this be mistaken for a template?” If yes, push one axis (type, layout, or color story).

## Optional reference

For extended examples or team-specific addenda, add `reference.md` beside this file and link it here.
