# design-input/ — Claude design export drop-zone

Drop **Claude design exports** here. Everything in this folder is **git-ignored**
(except this README) — exports are *referenced* by the Claude workflow, never committed.

## How to use

1. Ask Claude-design to produce the design by **uploading `.claude/design-brief.md`** (that brief
   defines the required output shape below).
2. Create one kebab-case subfolder per export, e.g. `design-input/ciaa-dealer-directory/`.
3. Drop the export in, in this **structured** shape:

```
<export-name>/
├── design.md            brand story + look
├── art-direction.md     the art-direction spec (rules, dials, do/don'ts)
├── tokens/              colors.md · typography.md · spacing.md · radii.md · motion.md
├── pages/<page>/        <page>.html (Tailwind, component boundaries marked) + <page>.motion.md
├── components/          components.md (which blocks repeat)
├── content/             <page>.content.md (copy; CMS fields flagged)
└── assets/              logos/ · photos/ · icons/ · video/
```

## What reads from here

| Command | Reads | Produces |
|---|---|---|
| `/project-setup` | `tokens/` · `art-direction.md` | theme tokens, fonts, global CSS, Tier-1, motion kit |
| `/criteria`      | `pages/<page>/` (html + motion) · `art-direction.md` · `content/` | a per-section build spec |
| `/build-component` | the page HTML section + the registry | the Next.js component(s) |

## Rules

- **`tokens/` + `art-direction.md` win.** If the exported HTML disagrees, follow them.
  (Older flat export — a single `design.md` + `*Tailwind.html` — is supported as a fallback.)
- Markup is **Tailwind CSS** (v4-compatible). **No `clamp()`** (iOS/Safari) → breakpoint steps.
- Optimized assets get copied into `frontend/public/` (WebP, ≤200 KB desktop / ≤100 KB mobile);
  the raw export stays here, untracked. **Never reference `design-input/` at runtime.**
