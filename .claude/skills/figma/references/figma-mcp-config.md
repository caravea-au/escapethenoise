# Figma MCP config reference (Claude Code)

The Figma MCP server is a remote **streamable HTTP** server at `https://mcp.figma.com/mcp`. In Claude Code it is registered in the project-level `.mcp.json` under the server key `figma`, and authenticated interactively via the `/mcp` command (OAuth) — no manually managed bearer token or env var is required.

## Register the server (`.mcp.json`)

Add (or confirm) the `figma` entry in the project's `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

- `type: "http"` selects the streamable HTTP transport Claude Code uses for remote MCP servers.
- The server key `figma` is what the tools are namespaced under; keep it stable so tool names remain consistent.
- Because this lives in the project `.mcp.json`, the config is shared with the team via git. Claude Code will prompt for approval the first time it loads a project-scoped MCP server.

## Authenticate (first use)

The Figma server uses OAuth, not a static token:

1. Run `/mcp` in Claude Code to open the MCP server list.
2. Select the `figma` server and choose **Authenticate** (or **Login**). This opens a browser OAuth flow with Figma.
3. Approve access in the browser; Claude Code stores the credentials and marks the server **connected**.

There is no `FIGMA_OAUTH_TOKEN` env var to export and no shell profile to edit — authentication is handled entirely through the `/mcp` flow.

## Verify

- Run `/mcp` and confirm the `figma` server shows a **connected** status.
- Ask Claude to list the available Figma tools, or run a simple call (e.g. `whoami` on the remote server) to confirm the server is reachable and authenticated.

## Troubleshoot

- **Server not listed / not loading:** confirm the `figma` entry exists in the project `.mcp.json` and that you approved the project MCP servers when prompted. Restart Claude Code after editing `.mcp.json`.
- **Auth errors / "not authenticated":** re-run `/mcp`, select `figma`, and re-authenticate. Complete the browser OAuth flow fully and return to Claude Code.
- **Tools missing after connect:** reconnect via `/mcp`, or restart the Claude Code session so the tool list is refreshed.

## Usage reminders

- The server is link-based: copy the Figma frame or layer link, then ask Claude to implement that URL. The client will extract the node ID from the link (it does not browse the page).
- If output feels generic, restate the project-specific rules from the main skill and ensure you follow the required flow (get_design_context → get_metadata if needed → get_screenshot).
