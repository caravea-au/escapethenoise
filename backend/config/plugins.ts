import type { Core } from '@strapi/strapi';

const config = (_: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  mcp: {
    enabled: true,
    config: {
      session: {
        type: 'memory',
      },
      allowedIPs: ['127.0.0.1', '::1'],
    },
  },
});

export default config;
