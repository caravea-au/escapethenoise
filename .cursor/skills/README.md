# Project skills (repo-only)

Do **not** rely on personal skills in `~/.cursor/skills/` for this project’s conventions—everything below is in git.

## Layout

| Path | Purpose |
|------|---------|
| **`.agents/skills/`** | Installed by [`npx skills add … -y`](https://skills.sh) (see root `skills-lock.json`). Canonical copy of upstream skills (SKILL.md, assets). |
| **`.cursor/skills/`** | Project-authored skills (`frontend-design`, `ui-delivery-stack`) plus **junctions** to `.agents/skills/` for `ui-ux-pro-max`, `context7`, and `figma` so Cursor discovers them in one place. |
| **`src/ui-ux-pro-max/`** | Scripts + CSV data for UI/UX Pro Max (`scripts/search.py`, `data/`). Required because the skills package expects this path; `skills/ui-ux-pro-max` is a junction → `src/ui-ux-pro-max` for the documented `python skills/ui-ux-pro-max/scripts/search.py` commands. |

## Reinstall / update

From the repo root:

```bash
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max -y
npx skills add https://github.com/intellectronica/agent-skills --skill context7 -y
npx skills add https://github.com/openai/skills --skill figma -y
```

If **`src/ui-ux-pro-max`** is missing (search script fails), restore it by cloning [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and copying `src/ui-ux-pro-max` into this repo, or re-run the copy step from that repo’s `src/ui-ux-pro-max` folder.

**Superpowers** is a Cursor **plugin** (`/add-plugin superpowers`), not files under `.cursor/skills/`—install it from the Cursor marketplace if you want that workflow.

## Windows note

Junctions under `.cursor/skills/` and `skills/` are created with `New-Item -ItemType Junction`. If clone/checkout breaks them, recreate per [ui-delivery-stack/reference.md](ui-delivery-stack/reference.md).
