---
description: Push the current branch and open a PR to `main`, then clean up — stop QA dev servers and remove the task worktree. The only command that pushes.
argument-hint: (none) | "<PR title hint>"
---

Open a pull request from the current branch into `main`, then **clean up after the build**. This is
the **only** command that pushes (`/commit` never does). Assumes the work is already committed
locally (via `/commit`) and green.

## Preconditions
1. **Not on `main`.** Must be on a `feature/` / `fix/` / `chore/` branch with commits ahead of
   `main`. If the tree is dirty, run `/commit` first — this command does not commit.
2. **Green.** `npm run build` passes and the page/site has been through `/qa` (or the per-section
   gate). If QA hasn't run, say so and confirm before opening the PR.
3. **No Claude attribution** in the PR title or body (user preference — same as `/commit`): no
   `Co-Authored-By`, no "🤖 Generated with Claude Code" footer.

## Flow
1. Confirm branch · `git status` clean · `git log main..HEAD` (what the PR will contain). Show it.
2. `git push -u origin HEAD`.
3. `gh pr create --base main --head <branch>` — title = `type(scope): summary` from the branch;
   body = short what/why + a bullet list of the notable commits. **No attribution footer.**
4. **Cleanup — always, after the PR exists:**
   1. **Stop the QA dev servers you started this session** — kill the background dev jobs (`TaskStop`
      on the `npm run dev` / `dev:backend` tasks) and any leftover node on the dev ports (Next
      **3000**, Strapi **1337**). Use the platform-correct kill: PowerShell
      `Get-NetTCPConnection -LocalPort <p> | Stop-Process` on Windows; `lsof -ti:<p> | xargs kill` on
      POSIX. **Do not touch servers you did not start.**
   2. **Remove the task worktree** — only if this task ran in a dedicated worktree. **`cd` back to the
      main repo root FIRST** (never remove the worktree you're standing in), then
      `git worktree remove <path>` and `git worktree prune`. Leave the primary checkout / `main` alone.
5. Report: the **PR URL**, which servers were stopped, and whether a worktree was removed.

## Never
- Never **merge** the PR — opening it is the last step; merging is the human moment.
- Never force-push, and never push to `main` directly.
- Never remove the worktree while the cwd is inside it, and never delete the primary checkout.

Input: `$ARGUMENTS` = optional PR title hint; otherwise derive it from the branch and its commits.
