import type { Core } from '@strapi/strapi';

// Hosts that may serve uploaded media. With uploads on a DigitalOcean Space the
// admin panel and preview images load from an off-origin host, so it must be
// allowed in the CSP img-src/media-src or Strapi blocks it. Covers both the
// virtual-hosted bucket URL (<bucket>.<endpoint-host>) and an optional CDN host.
const mediaHosts = ({ env }: Core.Config.Shared.ConfigParams): string[] => {
  const hosts = new Set<string>();
  const add = (url?: string) => {
    if (url) {
      try {
        hosts.add(new URL(url).host);
      } catch {
        /* ignore malformed env */
      }
    }
  };
  const endpoint = env('DO_SPACE_ENDPOINT');
  const bucket = env('DO_SPACE_BUCKET');
  add(endpoint);
  if (endpoint && bucket) {
    const u = new URL(endpoint);
    hosts.add(`${bucket}.${u.host}`);
  }
  add(env('DO_SPACE_CDN_URL'));
  return [...hosts];
};

const config = (params: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...mediaHosts(params)],
          'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...mediaHosts(params)],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
