/**
 * Caravea Connect single-registration read —
 * `GET {CONNECT_API_URL}/api/public/dealer-registrations/{submissionId}`.
 *
 * Exists because /find-dealer now lists dealers pulled from Connect rather than
 * from `dealer-submission`, so the id an enquiry arrives with is a Connect
 * `submission_id` and resolves to no local row. This is how the enquiry
 * controller gets a TRUSTED dealership name (never taking one from the request
 * body) and confirms the dealer is actually approved before storing a lead.
 *
 * Shaped after connect-client.ts: typed flat result, global `fetch`, a bounded
 * timeout, never throws, never logs a response body.
 */

import type { Core } from '@strapi/strapi';

const REGISTRATIONS_PATH = '/api/public/dealer-registrations';
const TIMEOUT_MS = 5_000;

/**
 * Flat rather than a discriminated union on `ok` — this backend compiles with
 * `strict: false` (backend/tsconfig.json), and without strictNullChecks
 * TypeScript will not narrow a boolean-literal discriminant, so
 * `if (result.ok) result.name` fails to compile on a union. Same reason as
 * `ConnectPushGateResult` in connect-registration.ts.
 */
export type ConnectDealerLookup = {
  ok: boolean;
  /** Set only when `ok` — the dealership name as Connect holds it. */
  name?: string;
  /** Set only when `ok`. False for a dealer Connect has not approved. */
  approved?: boolean;
  code?: 'connect-disabled' | 'dealer-not-found' | 'connect-unavailable';
};

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Whether Connect considers this dealer approved.
 *
 * Deliberately duplicated from `isApproved` in frontend/src/lib/connect.ts —
 * the two workspaces build separately and share no module, and this copy is the
 * one that actually GATES anything (the frontend copy only decides whether to
 * render a form). Keep them in step: Connect is adding an explicit approval
 * boolean to the payload, checked for first here under each name it could ship
 * as, before falling back to `status` / `approved_at`, which is all the read
 * shape exposes today.
 *
 * Unrecognisable state reads as NOT approved. This is a gate, so it fails closed.
 */
function readApproved(record: Record<string, unknown>, company: Record<string, unknown>): boolean {
  for (const key of ['approved', 'is_approved', 'isApproved']) {
    if (typeof company[key] === 'boolean') return company[key] as boolean;
    if (typeof record[key] === 'boolean') return record[key] as boolean;
  }

  const status = str(company.status) ?? str(record.status);
  if (status) return status.toLowerCase() === 'approved';

  return str(company.approved_at) !== null;
}

export async function fetchConnectDealer(
  strapi: Core.Strapi,
  submissionId: string,
): Promise<ConnectDealerLookup> {
  const baseUrl = process.env.CONNECT_API_URL;
  const apiKey = process.env.CONNECT_API_KEY;

  // Read env INSIDE the function, never at module scope — a module-scope throw
  // here would break Strapi's content-type loading on every environment that
  // does not set these.
  if (!baseUrl || !apiKey) {
    return { ok: false, code: 'connect-disabled' };
  }
  if (!submissionId) {
    return { ok: false, code: 'dealer-not-found' };
  }

  // `source=nobettertime` is REQUIRED. Omit it and Connect does not 400 — it
  // 302s to its own login page, which `redirect: 'manual'` below turns into a
  // non-ok response rather than a "successful" fetch of an HTML login form.
  const url =
    `${baseUrl.replace(/\/+$/, '')}${REGISTRATIONS_PATH}/` +
    `${encodeURIComponent(submissionId)}?source=nobettertime`;

  try {
    const response = await fetch(url, {
      headers: { 'X-Caravea-Key': apiKey, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // A genuinely unknown id — distinct from Connect being down, because one
    // means "no such dealer" and the other means "try again shortly".
    if (response.status === 404) {
      return { ok: false, code: 'dealer-not-found' };
    }

    if (!response.ok) {
      // Never read or log the body: Connect's errors echo submitted field names
      // and values, which would put dealer PII into plaintext pm2 logs.
      strapi.log.warn(`[connect] dealer lookup failed (status=${response.status})`);
      return { ok: false, code: 'connect-unavailable' };
    }

    const record = obj(obj(await response.json()).data);
    const company = obj(record.company);
    const name = str(obj(company.company).name);

    if (!name) {
      return { ok: false, code: 'dealer-not-found' };
    }

    return { ok: true, name, approved: readApproved(record, company) };
  } catch (error) {
    // Log a chosen outcome word only — same PII discipline as above.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    strapi.log.warn(
      `[connect] dealer lookup failed (outcome=${timedOut ? 'timeout' : 'network-error'})`,
    );
    return { ok: false, code: 'connect-unavailable' };
  }
}
