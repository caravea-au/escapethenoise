---
description: Pre-flight health-check of the this baseplate Claude setup (MCPs, Node, build, lint, kit) before working. Read-only.
argument-hint: (none) — run /preflight at the start of a session
---

Verify the kit actually works **in this session**. Read-only — change nothing. Print a clear ✅/❌
table and, for every ❌, the exact fix command. Be honest: a tool the CLI lists but that you cannot
call here is **❌ not connected**, not ✅. (Named `/preflight`, not `/doctor`, to avoid clashing with
Claude Code's built-in `/doctor`, which checks the *Claude Code install* — a different thing.)

## 1. MCP servers — test the REAL in-session connection
For each, attempt one cheap call. If its tools aren't available this session, mark
❌ "not loaded — reload the window / approve the server" (do NOT trust `claude mcp list` alone).

- **strapi** → list content types (e.g. `strapi_list_servers` / `strapi_get_content_types`). Expect a response.
  If Strapi isn't running, that's a ⚠️ (start it: `npm run dev:backend`), not a kit failure.
- **next-devtools** → a cheap call (e.g. `nextjs_index` / `nextjs_docs`). Expect a response.
- **playwright** → confirm its tool namespace is loaded (do NOT open a browser). If absent, it was just added
  to `.mcp.json` — **reload the IDE window and approve it**; until then the visual gate falls back to a human check.
- **figma** → confirm its tool namespace is loaded (e.g. a `figma` resource/tool listing). Expect a response
  if the server is approved; if not connected, that's ❌ "not loaded — reload the window / approve the server."
  Not every project uses Figma as the design front door, so an unused-but-connected server is fine — only flag
  it if `/agentic-team` is actually in play for this project and the server can't be reached.

> All four are wired in `.mcp.json` (base `.mcp.json` ships `figma` as an HTTP MCP for `/agentic-team`).

## 1b. Sync drift (read-only)
Run `npx claude-brain sync --check` and report the result:
- ✅ "in sync" if it exits 0 (no drift).
- ⚠️ "kit drift — run `npx claude-brain sync`" if it reports any create/update/prune, listing the changed paths.

## 2. Toolchain (PowerShell)
Run and report each:
- `node -v` (engine range >=20 <=24; prefer 20 or 22)
- `npm run lint` runs. (If the frontend is on Next 16, `next lint` is removed — switch the script to the
  ESLint CLI / flat config. Any pre-existing baseplate placeholder-file lint errors clear when `/project-setup`
  replaces those files — note them, don't treat as a kit failure.)
- `npm run build` is runnable (you may report "not run" if it's slow — just confirm the script exists)
- `sharp` is installed in `frontend/` if `optimize:image` is used (`npm ls sharp -w frontend`) — `/project-setup`
  adds it. Not a failure if absent pre-setup.
- If `better-sqlite3` errors with `NODE_MODULE_VERSION`: fix = `npm rebuild better-sqlite3` from `backend/`.

## 3. Kit & inputs present
- `.claude/skills/` has `nextjs-component-standards`, `motion-standards`, `design-taste-frontend`, `caveman`, `ponytail`, `ponytail-review`.
- `motion` + `lenis` installed in `frontend/` (`npm ls motion lenis -w frontend`) — needed by the motion kit.
- Kit docs exist: `.claude/COMPONENTS.md` · `.claude/QUALITY-BAR.md` · `.claude/PROJECT-PLAN.md` · `.claude/design-brief.md`.
- `design-input/` exists and is git-ignored (`git check-ignore design-input/anything` should print a path).
- At least one export under `design-input/<export>/` with the structured shape (`tokens/` + `pages/`),
  or an older flat `design.md` + `*Tailwind.html` (else ⚠️ "drop an export first").

## 4. Report
Print a table: **Component | Status | Fix if ❌**. End with a one-line verdict:
- ✅ "Setup healthy — safe to /project-setup → /criteria → /build-component."
- ❌ "N issues — fix before building," then the smallest set of commands to green it.

After any MCP change, remind the user: **reload the IDE window** and **approve** the `.mcp.json`
servers on first prompt (one-time).
