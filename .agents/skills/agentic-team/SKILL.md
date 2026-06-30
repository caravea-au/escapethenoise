---
name: agentic-team
description: Run this repository's coordinated Agentic Fullstack Delivery Team for Figma-to-production work. Use when the user asks for `/agentic-team`, the agentic team, Cursor's agentic fullstack delivery team, or a multi-role Figma-to-frontend/backend implementation workflow.
---

# Agentic Fullstack Delivery Team

Use this skill to give Codex the same delivery workflow defined in Cursor under `.cursor/commands/agentic-team.md`, `.cursor/rules/agentic-fullstack-delivery-team.mdc`, and `.cursor/agents/`.

## Reference Files

Before starting an agentic-team run, read only the reference files needed for the request:

- `references/agentic-team-command.md`
- `references/agentic-fullstack-delivery-team.mdc`
- `references/agents/README.md`
- `references/agents/project-manager-agent.md`
- `references/agents/frontend-architect-agent.md`
- `references/agents/backend-architect-agent.md`
- `references/agents/developer-subagent.md`
- `references/agents/design-qa-agent.md`
- `references/agents/accurate-design-qa-agent.md`
- `references/agents/functional-compatibility-qa-agent.md`
- `references/agents/integration-qa-agent.md`
- `references/agents/accessibility-qa-agent.md`
- `references/agents/performance-optimization-qa-agent.md`
- `references/agents/security-qa-agent.md`
- `references/agents/documentation-agent.md`

Also read the project guidance that applies to the task:

- `AGENTS.md`
- `docs/FRONTEND-STRUCTURE.md`
- `docs/COMPONENT-LIBRARY.md`
- `docs/FIGMA-REFERENCES.md`
- `docs/TESTING-CHECKLIST.md`

## Inputs

Use values provided by the user:

- Figma design link or Figma context
- Target page or feature
- Local app URL

If the target page/feature or Figma context is missing, ask one concise clarifying question before architecture planning. If only the local app URL is missing, proceed and discover the dev command when validation is needed.

## Codex Coordination

Treat the roles in `references/agents/` as active working roles. The Project Manager Agent controls phase transitions, task priority, assignments, validation, server cleanup, and final approval.

When the multi-agent tool is available and the user has asked to use the agentic team, use sub-agents for bounded, parallel work where useful:

- Use explorer agents for independent repository discovery, styling audits, backend/API discovery, or QA investigations.
- Use worker agents for disjoint implementation tasks with explicit file ownership.
- Do not duplicate the same investigation across agents.
- Keep the immediate blocking path local in the main Codex thread.
- Tell worker agents that other edits may exist and they must not revert unrelated changes.

If the multi-agent tool is unavailable, simulate the same roles sequentially in the main Codex thread and clearly label each role report.

## Workflow

Follow this workflow exactly:

1. Repository Discovery
   - Inspect project structure, package scripts, frontend stack, backend stack, styling system, test tools, and conventions.
   - Do not edit files yet.
   - Produce the Repository Discovery report.
2. Figma Understanding
   - Read the Figma link/context.
   - Use Figma MCP if available, with a hard limit of one Figma design-context fetch for the current agentic-team invocation.
   - The Project Manager owns this single fetch. Fetch the broadest useful node once, then summarize and share the captured context with all architects, developer agents, and QA agents.
   - Do not call Figma MCP read tools again during the same invocation unless the user explicitly approves the extra quota use.
   - If the first fetch is incomplete or truncated, continue from the returned context, pasted context, existing screenshots/assets, and repo docs. Ask before spending another Figma MCP call.
3. Architecture Planning
   - Frontend Architect reports component tree, reuse plan, new components, state/data flow, styling strategy, and accessibility considerations.
   - Backend Architect reports backend/API plan if backend changes are needed.
   - Project Manager converts plans into small implementation tasks with acceptance criteria.
4. Implementation
   - Developer agents implement one assigned task at a time.
   - Preserve existing functionality.
   - Reuse existing code, tokens, components, utilities, API clients, schemas, and Strapi patterns.
   - Avoid new dependencies unless clearly justified.
   - Commit each completed task as a checkpoint if git is available and appropriate for the user request.
5. QA Validation
   - Run Design QA.
   - Run Accurate Design QA.
   - Run Functional and Compatibility QA.
   - Run Integration QA.
   - Run Accessibility QA.
   - Run Performance and Optimization QA.
   - Run Security QA.
6. Fix Loop
   - Project Manager deduplicates findings and assigns fixes.
   - Re-run the relevant QA role after each fix.
   - Continue until all P0 and P1 issues are resolved.
7. Final Review
   - Documentation Agent updates docs if needed.
   - Project Manager produces final approval status.
8. Local Server Cleanup
   - Stop any local frontend or backend dev servers started for verification unless the user explicitly asks to keep them running.
   - Prefer exact process IDs launched during validation.
   - If PIDs were not tracked, only stop processes whose command lines clearly point to this repository.
   - Report cleanup status before final approval.

## Constraints

- Follow existing repository structure and docs.
- Limit Figma MCP quota usage to one Project Manager-owned design-context fetch per invocation unless the user explicitly approves more.
- Reuse the Project Manager's captured Figma context for architecture, implementation, and QA.
- Do not create duplicate components when an existing one can be extended safely.
- Do not introduce dependencies unless clearly justified.
- If a change affects functionality, validate with Functional and Compatibility QA.
- If a change affects performance, validate with Performance QA and then Functional QA.
- If a change affects styling, validate with Design QA and Accurate Design QA.
- Never mark complete until the Project Manager has reviewed all agent reports.
- Never mark complete while local frontend/backend verification servers started by the team are still running, unless the user explicitly asked to leave them running.

## Required Final Output

1. Implementation summary
2. Final file changes
3. Components created or reused
4. Backend/API changes
5. Tests/checks run
6. Figma MCP quota usage
7. Design accuracy report
8. Functional QA report
9. Performance report
10. Accessibility report
11. Security report
12. Remaining known issues
13. Manual review checklist
14. Local server cleanup status
15. Final approval status
