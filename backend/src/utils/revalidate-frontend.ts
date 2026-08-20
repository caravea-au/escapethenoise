/**
 * Tells the Next.js frontend to drop a cached data tag right now.
 *
 * WHY THIS EXISTS AT ALL. /find-dealer reads Strapi through Next's data cache
 * with a 60 second window, and that window has two properties worth stating
 * plainly: it is stale-while-revalidate, so the first visitor after expiry still
 * sees the OLD data and only triggers the refresh; and it does not move at all
 * without traffic. Both are fine for the 10-minute sync — a Connect edit taking
 * a few minutes to appear is expected. Neither is fine for the publish toggle,
 * which after ETN-013's D2 ruling is the ONLY human-facing action left on a
 * dealer: staff will unpublish a dealer and immediately reload /find-dealer, and
 * a 60 second wait there gets reported as a bug.
 *
 * So this fires on a human publish/unpublish and NEVER on the sync — see
 * `withoutRevalidate`, and the lifecycle hook in
 * api/dealer/content-types/dealer/lifecycles.ts.
 *
 * Fail-soft throughout: an unset config or an unreachable frontend must never
 * turn a successful publish into an error in the admin panel.
 */

import type { Core } from '@strapi/strapi';

/** The Next `fetch` tag the /find-dealer getters are registered under. */
export const DEALERS_TAG = 'dealers';

const TIMEOUT_MS = 5_000;

// Depth counter, not a boolean: the sync's write phase is one nesting today,
// but a boolean would be silently cleared by the inner call if that ever
// changed, re-arming the pings mid-sweep.
let suppressionDepth = 0;

/**
 * Runs `fn` with revalidation pings suppressed.
 *
 * The dealer sync writes up to one row per dealer, and every one of those writes
 * trips the same content-type lifecycle a human publish does. Without this, a
 * first sweep of 180 dealers would fire 180 HTTP calls at the frontend to
 * invalidate the same single tag.
 *
 * Known, accepted gap: Node is single-threaded but this is async, so a human who
 * hits publish *while* a sweep is running has their ping suppressed too. They
 * fall back to the 60 second cache window, which is the pre-ETN-013 behaviour
 * rather than a regression, and a sweep takes seconds.
 */
export async function withoutRevalidate<T>(fn: () => Promise<T>): Promise<T> {
  suppressionDepth += 1;
  try {
    return await fn();
  } finally {
    suppressionDepth -= 1;
  }
}

export function revalidateSuppressed(): boolean {
  return suppressionDepth > 0;
}

/**
 * POSTs one tag invalidation to the frontend's /api/revalidate route.
 *
 * `REVALIDATE_URL` is the frontend's own origin, and `REVALIDATE_SECRET` must
 * match the value that route reads. Unset means dormant, which is the correct
 * default: without it the only cost is that a publish takes up to 60 seconds to
 * show, and a misconfigured secret would otherwise log a 401 on every toggle.
 */
export async function pingRevalidate(strapi: Core.Strapi, tag: string): Promise<void> {
  // Read env INSIDE the function, never at module scope — a module-scope throw
  // here would break Strapi's content-type loading wherever these are unset.
  const baseUrl = process.env.REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!baseUrl || !secret) return;

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Revalidate-Secret': secret,
      },
      body: JSON.stringify({ tags: [tag] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      strapi.log.warn(`[revalidate] ping rejected (tag=${tag}, status=${response.status})`);
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    strapi.log.warn(
      `[revalidate] ping failed (tag=${tag}, outcome=${timedOut ? 'timeout' : 'network-error'})`,
    );
  }
}
