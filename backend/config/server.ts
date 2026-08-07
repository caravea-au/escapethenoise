import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Behind nginx (production), Koa must trust X-Forwarded-For or
  // `ctx.request.ip` resolves to the proxy's IP for every request — turning
  // the dealer-enquiry rate limit into a global lockout after 5 enquiries
  // from anyone. Defaults true; set IS_PROXIED=false only for a bare (no
  // reverse proxy) local run where trusting X-Forwarded-For would let a
  // client spoof its own IP.
  proxy: env.bool('IS_PROXIED', true),
});

export default config;
