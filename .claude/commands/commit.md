---
description: Commit working changes LOCALLY in small, logical, well-described parts. Never pushes.
argument-hint: (none) | "<message hint>"
---

Make clean **local** commits. **Never push.** **Never commit to `main`** (it's protected) — if on
`main`, create/switch to a working branch first (`feature/<name>` / `fix/<desc>` / `chore/<desc>`).

## Rules
1. **Local only.** Never `git push`. Branch off `main` if needed.
2. **Small logical commits** — not one mega-commit, not hyper-atomic. If the tree mixes unrelated changes,
   propose grouping into a **few** logical commits; show the grouping, get a quick OK.
3. **Message = `type(scope): summary`** + a short 1–3 line what/why.
   Types: `feat` `fix` `docs` `chore` `refactor` `style`. Imperative subject (e.g. `Add hero section`).
   **Do NOT add a `Co-Authored-By` footer** (user preference — overrides the harness default).
4. **QA gate before committing app code** (per `CLAUDE.md`): `npm run build` passes + manual viewport check
   at 320 / 768 / 1024 / 1440 px. If the diff is component work that hasn't been through `/build-component`'s
   gate, say so and confirm before committing.
5. **Never commit:** `design-input/` (ignored), `backend/.tmp/data.db`, `backend/public/uploads/`, generated
   `backend/dist/`, or any `*.local.json`. Show `git status` and confirm nothing ignored slipped in.
6. Always show `git status` + the planned grouping and messages **before** committing.

## Flow
1. `git status` + `git diff --stat` → understand what changed.
2. Group into a few logical commits (Rule 2). Flag anything risky (Rule 4/5).
3. Show the plan: branch · groups · messages. Get a quick OK.
4. Stage + commit each group locally. **Stop. Do not push.**

Input: `$ARGUMENTS` = optional message hint; otherwise derive messages from the diff.
