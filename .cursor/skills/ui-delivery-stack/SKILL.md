---
name: ui-delivery-stack
description: >-
  Orchestrates end-to-end UI delivery: UI/UX Pro Max for design intelligence and
  tokens, Context7 for current library docs, Figma MCP for design-to-code
  fidelity, and Superpowers-style discipline (spec, plan, TDD, review). Use when
  building or refactoring substantial UI, implementing from Figma links,
  choosing palettes/typography/motion, or when the user wants polished interfaces
  with up-to-date framework guidance and structured execution.
---

# UI delivery stack

**Scope:** This skill and sibling skills under [.cursor/skills/](../) are **repository-only**—keep them in git; do not depend on global `~/.cursor/skills/` for this project. See [README.md](../README.md).

Combines four upstream capabilities into one repeatable workflow. Read this skill at the start of relevant tasks; use [reference.md](reference.md) for install URLs and long command blocks.

## When to apply

- New pages, dashboards, marketing UI, or component libraries
- Visual or UX review, accessibility passes, design-system choices
- Implementation that must match a Figma frame or use current Next/React/etc. APIs
- Multi-step features where spec clarity and test-first delivery help

**Skip** for pure backend, infra-only work, or one-line CSS tweaks with no design impact.

## Execution order (default)

Work top-down unless the user names a single step.

1. **Clarify intent** — Align with [Superpowers](https://github.com/obra/superpowers)-style practice: confirm problem, constraints, and acceptance before large edits. For greenfield UI, capture product type, audience, and stack in a few lines.
2. **Design intelligence** — Before locking pixels, run **UI/UX Pro Max** (`--design-system` first). Persist tokens to `design-system/MASTER.md` when the project uses the optional persist flow (see reference).
3. **Fresh docs** — When touching unfamiliar APIs or verifying breaking changes, query **Context7** (search library ID, then `context` with `type=txt`). Prefer this over guessing framework behavior.
4. **Figma** — If the user provides a Figma URL or “match the design,” follow the **mandatory Figma MCP sequence** below before coding.
5. **Implement** — Map Pro Max tokens and Figma structure onto **this repo’s** components, CSS variables, and routing. Treat any MCP-generated Tailwind/snippets as representation only.
6. **Quality bar** — Cross-check Pro Max priority table (accessibility → touch → performance → style → …). Use Superpowers-aligned habits: small verifiable steps, tests where the project already uses them, review before merge.

## 1. UI/UX Pro Max ([skills.sh](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max))

- Install **into this repo** (project root) so `skills/ui-ux-pro-max/scripts/search.py` exists and can be committed; see [reference.md](reference.md). Do not install UI/UX Pro Max only to the user profile—keep it in-repo for shared, reproducible runs.
- **Always start** with a design-system query:

  `python3 skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <keywords>" --design-system -p "Project Name"`

- Add `--persist` (and optional `--page "screen"`) when the team wants `design-system/MASTER.md` and page overrides.
- Deep-dive with `--domain` (`ux`, `color`, `typography`, `style`, `chart`, etc.) and `--stack react` or `react-native` per project.
- Use `-f markdown` when pasting output into docs.

## 2. Context7 ([skills.sh](https://skills.sh/intellectronica/agent-skills/context7))

Use for library/framework facts that must be current.

1. Search: `GET .../libs/search?libraryName=...&query=...` → read `id` from results.
2. Fetch: `GET .../context?libraryId=...&query=...&type=txt` for readable prose.

Full curl examples: [reference.md](reference.md). No API key for basic use; respect rate limits.

## 3. Figma MCP ([OpenAI Figma skill](https://skills.sh/openai/skills/figma))

**Do not skip or reorder** for implementation tasks tied to a file:

1. **get_design_context** (or **get_metadata** if truncated, then narrow nodes).
2. **get_screenshot** for the same node/variant.
3. Download assets from MCP localhost URLs when provided; **use those assets** — no placeholder icons if sources exist.
4. Implement using **project** tokens, components, and patterns — not a verbatim paste of generated Tailwind.
5. Validate visually against the screenshot before calling the task done.

If the workspace also has **figma-use** / plugin API skills, load **figma-use** before any `use_figma` tool calls; that path is for canvas/plugin operations, not a substitute for the MCP design-context flow above.

## 4. Superpowers ([obra/superpowers](https://github.com/obra/superpowers))

- Install the **Superpowers** plugin from the Cursor marketplace when the user wants the full workflow (`/add-plugin superpowers` or marketplace search).
- Let its skills handle brainstorming, planning, git worktrees, TDD, and code review **when installed**; this stack skill does not duplicate those prompts—it **aligns** UI work with the same habits: spec visible, plan chunked, evidence-based completion.
- If Superpowers is not installed, still apply the same discipline: agree on scope, break work into checkable steps, write or update tests if the repo expects them.

## Pre-handoff checklist (UI)

- §1–3 from Pro Max quick reference: contrast, focus, keyboard, loading/CLS basics.
- No emoji as structural icons; consistent icon set; touch targets ≥44×44pt (web: adequate hit areas).
- Dark/light tested if both exist; reduced-motion respected for non-essential animation.

## Further reading

- Install commands and copy-paste blocks: [reference.md](reference.md)
- Distinctive craft and anti-generic-UI guidance: [.cursor/skills/frontend-design/SKILL.md](../frontend-design/SKILL.md) (when present)
