import type { Core } from '@strapi/strapi';

const config = (_params: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  // SMTP credentials are no longer configured here. They live in the
  // "SMTP Settings" single type (admin-managed, not .env) and are read at
  // send-time by the dealer-submission afterCreate lifecycle, which builds its
  // own nodemailer transport. See:
  //   backend/src/api/dealer-submission/content-types/dealer-submission/lifecycles.ts

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
