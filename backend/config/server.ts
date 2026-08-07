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
  //
  // It MUST be nested under `koa`. Strapi reads `server.proxy.koa`
  // (@strapi/core/dist/services/server/index.js), so a plain boolean at
  // `server.proxy` is silently ignored and Koa keeps app.proxy = false.
  //
  // DEPLOY REQUIREMENT: nginx must OVERWRITE the header
  // (`proxy_set_header X-Forwarded-For $remote_addr;`), not append via
  // $proxy_add_x_forwarded_for. Koa's request.ip takes the LEFTMOST entry,
  // so an appending proxy leaves it client-controlled and the rate limit
  // becomes spoofable with a rotating header.
  proxy: { koa: env.bool('IS_PROXIED', true) },
});

export default config;
