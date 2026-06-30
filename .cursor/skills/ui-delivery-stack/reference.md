# UI delivery stack — reference

**Repo-only:** Run installs below from the **repository root** so generated folders (e.g. `skills/ui-ux-pro-max/`) live in this project and are committed. Do not add these skills only under `~/.cursor/skills/` if you want the team to share them.

## Install: UI/UX Pro Max

From [ui-ux-pro-max on skills.sh](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max), at repo root:

```bash
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
```

After install, the search script path is typically:

`skills/ui-ux-pro-max/scripts/search.py` (relative to repo root)

Requires Python 3. On Windows without `python3`, use `py -3` or `python` per environment.

### Example commands

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "fintech dashboard minimal" --design-system -p "My App"
python3 skills/ui-ux-pro-max/scripts/search.py "fintech dashboard minimal" --design-system --persist -p "My App"
python3 skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux -n 8
python3 skills/ui-ux-pro-max/scripts/search.py "list navigation" --stack react-native
```

## Install: Superpowers (Cursor)

- Marketplace: install plugin **superpowers** (see [obra/superpowers README](https://github.com/obra/superpowers)).
- In Agent chat: `/add-plugin superpowers` or search the marketplace.

Skills (brainstorming, writing-plans, test-driven-development, etc.) load automatically when the plugin is installed.

## Context7 API

Base URL: `https://context7.com/api/v2`

### Search for library ID

```bash
curl -s "https://context7.com/api/v2/libs/search?libraryName=nextjs&query=app+router"
```

Use `jq` if available: `jq '.results[0]'` to inspect the best match.

### Fetch documentation (plain text)

```bash
curl -s "https://context7.com/api/v2/context?libraryId=/vercel/next.js&query=middleware&type=txt"
```

Replace `libraryId` with the value from search results. URL-encode spaces as `+` or `%20`.

## Figma MCP (design → code)

Follow the **OpenAI Figma skill** workflow:

1. Design context (structured nodes) for the exact selection.
2. Screenshot for visual parity.
3. Assets via MCP URLs when present.
4. Implement with project design tokens and components.

Project-specific MCP setup may live in repo docs (e.g. `references/figma-mcp-config.md` if copied from the OpenAI skill).

## Related skills.sh pages

- [ui-ux-pro-max](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max)
- [context7](https://skills.sh/intellectronica/agent-skills/context7)
- [figma (OpenAI)](https://skills.sh/openai/skills/figma)
