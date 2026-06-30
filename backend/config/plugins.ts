import type { Core } from '@strapi/strapi';

const config = (_: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // The `mcp` plugin below is disabled because no matching plugin package is
  // installed or published on npm, which prevented Strapi from booting
  // ("Error loading the plugin mcp because mcp is not installed"). Strapi MCP
  // access is already provided by the standalone `@bschauer/strapi-mcp-server`
  // configured in the repo-root `.mcp.json` (it talks to Strapi over REST and
  // needs no in-Strapi plugin). Re-enable this block only once a real `mcp`
  // plugin package is added to backend/package.json dependencies.
  //
  // mcp: {
  //   enabled: true,
  //   config: {
  //     session: {
  //       type: 'memory',
  //     },
  //     allowedIPs: ['127.0.0.1', '::1'],
  //   },
  // },
});

export default config;
