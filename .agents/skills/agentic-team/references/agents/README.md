# Agentic Fullstack Delivery Team

These files define the Cursor agent team for turning Figma designs into production-ready frontend/backend work in this repository.

Run the team from Cursor chat with:

```text
/agentic-team
```

Then paste the Figma link or context, target page or feature, and local app URL if available.

## Team

- [Project Manager Agent](project-manager-agent.md)
- [Frontend Architect Agent](frontend-architect-agent.md)
- [Backend Architect Agent](backend-architect-agent.md)
- [Developer Subagent](developer-subagent.md)
- [Design QA Agent](design-qa-agent.md)
- [Accurate Design QA Agent](accurate-design-qa-agent.md)
- [Functional and Compatibility QA Agent](functional-compatibility-qa-agent.md)
- [Integration QA Agent](integration-qa-agent.md)
- [Accessibility QA Agent](accessibility-qa-agent.md)
- [Performance and Optimization QA Agent](performance-optimization-qa-agent.md)
- [Security QA Agent](security-qa-agent.md)
- [Documentation Agent](documentation-agent.md)

## Repository Defaults

- Follow `AGENTS.md`, `docs/FRONTEND-STRUCTURE.md`, and `docs/COMPONENT-LIBRARY.md`.
- Use `.cursor/mcp.json` for Figma, Next devtools, and Playwright MCP access when available.
- For `/agentic-team`, limit Figma MCP usage to one Project Manager-owned design-context fetch per invocation unless the user explicitly approves another quota use.
- Keep implementation tasks small and checkpoint with git commits when appropriate.
- Prefer existing components, data helpers, CSS modules, tokens, and Strapi conventions.
- Validate visual, functional, integration, accessibility, performance, and security concerns before final approval.
