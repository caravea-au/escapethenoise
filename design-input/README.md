# design-input/ — Claude design export drop-zone

Drop **Claude design exports** here. Everything in this folder is **git-ignored**
(except this README) — exports are *referenced* by the Claude workflow, never committed.

## How to use

1. Create one kebab-case subfolder per export, e.g. `design-input/ciaa-dealer-directory/`.
2. Put the export inside it. The files the workflow actually reads are:
   - `design.md` — the brand & design source of truth (tokens, type, components, motion, voice).
   - the **Tailwind** HTML (e.g. `Find a Dealer - Tailwind.html`) — the markup to build from.
   - `assets/` — logos, photos, video referenced by the design.
3. You can delete the rest of a raw export (DC runtime, DEMO build, `uploads/`, duplicate
   `assets/` copies) — they are not used.

## What reads from here

| Command | Reads | Produces |
|---|---|---|
| `/project-setup` | `design.md` | Tailwind theme tokens, global CSS, fonts, Tier-1 components |
| `/criteria`      | `design.md` + the Tailwind HTML | a per-section build spec (with reuse map) |
| `/build-component` | the Tailwind HTML section + the registry | the Next.js component(s) |

## Rules

- **design.md wins.** If the exported HTML and `design.md` disagree, follow `design.md`.
- **No `clamp()`** in the build (iOS/Safari). Responsive sizing → Tailwind breakpoint steps.
- Optimized assets get copied into `frontend/public/` (WebP, ≤200 KB desktop / ≤100 KB mobile);
  the raw export stays here, untracked.

> Structure: `design-input/<export-name-kebab-case>/{design.md, *Tailwind.html, assets/}`
