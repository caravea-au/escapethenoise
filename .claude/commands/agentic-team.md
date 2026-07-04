---
description: Run the coordinated Figma-to-production agentic delivery workflow
argument-hint: "[figma-link] [target-page/feature] [local-app-url]"
---

# Agentic Fullstack Delivery Team

Turn the provided Figma design into production-ready frontend/backend implementation with high design accuracy, correct functionality, strong performance, maintainable structure, and reusable components.

Inputs from the invocation (parse from `$ARGUMENTS`; ask if a blocking one is missing):
- **Figma design link or pasted Figma context**
- **Target page or feature**
- **Local app URL** (optional — discover the dev command if absent)

If the target page/feature or Figma context is missing, ask **one** concise clarifying question before architecture planning. If only the local app URL is missing, proceed and discover the dev command when validation is needed.

## You are the orchestrator (the former "Project Manager")

Claude Code subagents **cannot call other subagents** and cannot see each other's context, PIDs, or captured Figma summary. So **you, the main thread, own coordination**: phase transitions, task priority (P0–P3), delegation, Figma-context sharing, dev-server lifecycle, and final approval. The specialized roles live in `.claude/agents/` and are invoked by you via the Task tool:

`frontend-architect`, `backend-architect`, `frontend-developer`, `backend-developer`, `design-fidelity-qa`, `functional-qa`, `accessibility-qa`, `performance-qa`, `security-qa`, `documentation`.

Rules for delegation:
- Capture the Figma design context **once** yourself (see phase 2), then **paste that summary into the prompt of every architect/QA subagent** you invoke. Do not ask subagents to fetch Figma.
- The read-only QA subagents are independent — **invoke them in parallel** (multiple Task calls in one message), then consolidate.
- Only `frontend-developer` / `backend-developer` and `documentation` write files; architects and QA are read-only reporters. Sequence any fix → re-validate loop yourself.
- Track dev-server PIDs and URLs yourself so you can stop exactly what you started.

## Workflow

1. **Repository discovery.** Inspect structure, scripts, frontend/backend stacks, styling system, and conventions (root `CLAUDE.md`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `docs/FRONTEND-STRUCTURE.md`, `docs/COMPONENT-LIBRARY.md`). Do not edit yet. Produce a Repository Discovery report.
2. **Figma understanding.** Read the Figma link/context. Use the `figma` MCP if available, with a **hard limit of one design-context fetch per `/agentic-team` run**. Fetch the broadest useful node once, summarize it, and reuse that summary everywhere. Do not call further Figma MCP read tools this run unless the user explicitly approves the extra quota. If the first fetch is incomplete, continue from the returned context, pasted context, screenshots/assets, and repo docs. Identify screens, sections, components, breakpoints, tokens, typography, spacing, interactions, and assets.
3. **Architecture planning.** Delegate to `frontend-architect` (component tree, reuse plan, state/data flow, styling/token strategy, a11y). Delegate to `backend-architect` only if backend changes are needed (routes, controllers, services, content types, validation, auth, seed/migration, test plan). Then convert plans into small tasks with acceptance criteria.
4. **Implementation.** Delegate one task at a time to `frontend-developer` / `backend-developer` by area. Preserve existing functionality; reuse existing code, tokens, components, utilities, API clients, schemas, and Strapi patterns; avoid new dependencies unless clearly justified. Commit each completed task as a checkpoint if git is available.
5. **QA validation.** Reset local verification servers first: stop repo-local frontend/backend processes that clearly belong to this repo (`npm run dev`, `npm run dev:backend`, `next dev`, `next start`, standalone frontend server, `strapi develop`), then start fresh with the discovered commands and track PIDs/URLs. Then fan out (in parallel where possible): `design-fidelity-qa`, `functional-qa`, `accessibility-qa`, `performance-qa`, `security-qa`. Pass each the captured Figma summary and the local URL.
6. **Fix loop.** Deduplicate and prioritize findings (P0–P3). Delegate fixes to `frontend-developer` / `backend-developer` by area. Re-run the relevant QA subagent after each fix. Continue until all P0 and P1 issues are resolved; P2 resolved or explicitly deferred.
7. **Final review.** Delegate to `documentation` to update docs if needed. Produce the final report and approval status yourself.
8. **Local server cleanup.** Stop any dev servers you started for verification (by tracked PID; otherwise only processes whose command lines clearly point to this repo) unless the user asked to keep them running. Report cleanup status.

## Constraints

- Follow the existing repository structure and the `CLAUDE.md` rules (styling, Strapi content safety, generated output, media URLs).
- Limit Figma MCP usage to one design-context fetch per invocation unless the user approves more.
- Do not create duplicate components when an existing one can be extended safely.
- If a change affects functionality, validate with `functional-qa`. If it affects performance, validate with `performance-qa` and then re-run `functional-qa`. If it affects styling, validate with `design-fidelity-qa`.
- Never mark complete until you've reviewed all subagent reports, or while verification servers you started are still running (unless the user asked to keep them).

## Required final output

1. Implementation summary
2. Final file changes
3. Components created or reused
4. Backend/API changes
5. Tests/checks run
6. Figma MCP quota usage (used / skipped / exceeded-with-approval)
7. Design accuracy report
8. Functional QA report
9. Performance report
10. Accessibility report
11. Security report
12. Remaining known issues
13. Manual review checklist
14. Local server cleanup status
15. Final approval status
