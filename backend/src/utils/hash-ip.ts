/**
 * Stable, non-reversible per-IP key for rate limiting.
 *
 * Salted with the app key so the hashes are useless outside this deployment
 * and a stored `ipHash` can never be walked back to a visitor's address.
 *
 * `ctx.request.ip` is only trustworthy because config/server.ts sets
 * `proxy: { koa: env.bool('IS_PROXIED', true) }` AND nginx OVERWRITES
 * X-Forwarded-For rather than appending to it. If either changes, every
 * caller of this becomes either globally shared (one bucket for the whole
 * internet) or trivially spoofable.
 */

import crypto from 'crypto';

export function hashIp(ctx: { request: { ip?: string } }): string {
  const appKeys = strapi.config.get('server.app.keys') as string[] | undefined;
  const appKey = Array.isArray(appKeys) && appKeys[0] ? appKeys[0] : '';
  return crypto
    .createHash('sha256')
    .update(`${ctx.request.ip ?? ''}${appKey}`)
    .digest('hex');
}
