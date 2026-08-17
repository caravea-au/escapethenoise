/**
 * Caravea Connect inbound HTTP client — POSTs a mapped dealer registration to
 * `{CONNECT_API_URL}/api/public/dealer-registrations`.
 *
 * Shaped after verify-recaptcha.ts: typed result union, global `fetch`, a
 * bounded timeout, never throws. Deliberately has NO retry — the lifecycle
 * hook that calls this runs inside the dealer-submission create's DB write
 * transaction, so a retry would hold that transaction open even longer on an
 * already-slow request path.
 */

import type { Core } from '@strapi/strapi';

export type ConnectPushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; code: string };

const DEALER_REGISTRATIONS_PATH = '/api/public/dealer-registrations';
const TIMEOUT_MS = 5_000;

/**
 * `Boolean(url && key)` — no separate feature-flag env var. An unset key
 * already means dormant; a third switch would only add a mode where the key
 * is set and pushes silently never happen anyway.
 */
export function isConnectEnabled(): boolean {
  // Read env INSIDE the function, never at module scope: a module-scope
  // throw here would break Strapi's content-type loading on every
  // environment that doesn't set these vars.
  return Boolean(process.env.CONNECT_API_URL && process.env.CONNECT_API_KEY);
}

export async function postDealerRegistration(
  strapi: Core.Strapi,
  documentId: string,
  payload: Record<string, unknown>,
): Promise<ConnectPushResult> {
  const baseUrl = process.env.CONNECT_API_URL;
  const apiKey = process.env.CONNECT_API_KEY;

  if (!baseUrl || !apiKey) {
    return { ok: false, status: 0, code: 'connect-disabled' };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${DEALER_REGISTRATIONS_PATH}`, {
      method: 'POST',
      headers: {
        'X-Caravea-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      // No retry: a 5s cap keeps a dead/slow Connect from holding a dealer's
      // submit request (and its DB transaction) open any longer than it
      // already is. The dealer-submission row is saved regardless of this
      // call's outcome; a miss is covered by a separate re-push, not an
      // automatic retry here.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const durationMs = Date.now() - startedAt;

    if (response.ok) {
      strapi.log.info(
        `[connect] push ok (documentId=${documentId}, status=${response.status}, ${durationMs}ms)`,
      );
      return { ok: true, status: response.status };
    }

    // Never read or log the response body: Connect's 422s are Laravel
    // validation errors that echo submitted field NAMES AND VALUES back,
    // which would leak dealer PII into plaintext pm2 logs.
    strapi.log.warn(
      `[connect] push rejected (documentId=${documentId}, status=${response.status}, ${durationMs}ms)`,
    );
    return { ok: false, status: response.status, code: 'connect-rejected' };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    // Never log the raw error/rejection object — log a chosen outcome word
    // only, same PII discipline as the body above.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    const code = timedOut ? 'connect-timeout' : 'connect-network-error';
    strapi.log.warn(
      `[connect] push failed (documentId=${documentId}, status=0, outcome=${code}, ${durationMs}ms)`,
    );
    return { ok: false, status: 0, code };
  }
}
