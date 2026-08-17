/**
 * Caravea Connect single-registration read.
 *
 * Exists because /find-dealer now lists dealers pulled from Connect rather than
 * from `dealer-submission`, so the id an enquiry arrives with is a Connect id
 * and resolves to no local row. This is how the enquiry controller gets a
 * TRUSTED dealership name (never taking one from the request body) and confirms
 * the dealer is actually approved before storing a lead.
 *
 * TWO lookup routes, because Connect's own two endpoints disagree:
 *
 *  1. `GET /api/public/dealer-registrations/{submission_id}` — one request,
 *     returns the OLD nested shape. Only accepts the 26-character ULID
 *     `submission_id`, which Connect's list endpoint STOPPED emitting in its
 *     2026-08-17 redeploy.
 *  2. A paginated scan of `GET /api/public/dealer-registrations` matching
 *     `reference` / `caravea_company_id` — the ids the list emits now. Two
 *     requests at `per_page=100` for the current 119 registrations. Confirmed
 *     necessary: `caraveacomp|Vrpb3uPIK2QxIgYyeHWA` 404s on the show endpoint
 *     both raw and URL-encoded, and there is no `?reference=` filter (it is
 *     ignored and the full list comes back).
 *
 * The scan is the expensive path, so it is not the first thing tried. It is
 * also only ever reached from `create` in the dealer-enquiry controller, which
 * runs its per-IP rate limit (5 per 15 minutes) BEFORE resolving a dealer —
 * that limit is what stops this becoming an unauthenticated way to generate
 * Connect traffic.
 *
 * Shaped after connect-client.ts: typed flat result, global `fetch`, a bounded
 * timeout, never throws, never logs a response body.
 */

import type { Core } from '@strapi/strapi';

const REGISTRATIONS_PATH = '/api/public/dealer-registrations';
const TIMEOUT_MS = 5_000;

// Connect's ceiling — `per_page=200` returns
// `422 {"message":"The per page field must not be greater than 100."}`, and
// omitting it falls back to 10. `limit` / `page_size` / `pageSize` are ignored.
const SCAN_PAGE_SIZE = 100;

// Runaway guard on the scan (2,000 registrations). A miss costs at most this
// many sequential requests, so it must stay far below anything that would hold
// an enquiry POST open until the client gives up.
const MAX_SCAN_PAGES = 20;

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
 * Lifts the two levels this module reads out of whichever response shape
 * Connect returned. Mirrors `normaliseRecord` in frontend/src/lib/connect.ts.
 *
 *   OLD (nested, still what the show endpoint returns):
 *     { submission_id, company: { reference, status, approved_at,
 *                                 company: {…profile} } }
 *   NEW (flat, what the list returns since 2026-08-17):
 *     { reference, caravea_company_id, status, approved_at, company: {…profile} }
 *
 * The tell is `company.company`: an object there means the old wrapper is still
 * present. Connect ships no version flag, so this is a structural check.
 */
function normalise(record: Record<string, unknown>): {
  registration: Record<string, unknown>;
  profile: Record<string, unknown>;
} {
  const wrapper = obj(record.company);
  const isNested = wrapper.company !== undefined && !Array.isArray(wrapper.company);

  return {
    registration: isNested ? wrapper : record,
    profile: obj(isNested ? wrapper.company : record.company),
  };
}

/** Every id Connect might identify this registration by, in either shape. */
function identifiers(
  record: Record<string, unknown>,
  registration: Record<string, unknown>,
): string[] {
  return [
    str(record.submission_id),
    str(registration.reference),
    str(registration.caravea_company_id),
  ].filter((value): value is string => value !== null);
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
 * shape exposes today. (Re-checked 2026-08-17 across all 119 registrations: the
 * boolean still is not there, and every record is `pending` with a null
 * `approved_at`.)
 *
 * Unrecognisable state reads as NOT approved. This is a gate, so it fails closed.
 */
function readApproved(
  record: Record<string, unknown>,
  registration: Record<string, unknown>,
): boolean {
  for (const key of ['approved', 'is_approved', 'isApproved']) {
    if (typeof registration[key] === 'boolean') return registration[key] as boolean;
    if (typeof record[key] === 'boolean') return record[key] as boolean;
  }

  const status = str(registration.status) ?? str(record.status);
  if (status) return status.toLowerCase() === 'approved';

  return (str(registration.approved_at) ?? str(record.approved_at)) !== null;
}

/** One registration → the lookup result, or not-found if it carries no name. */
function toLookup(record: Record<string, unknown>): ConnectDealerLookup {
  const { registration, profile } = normalise(record);
  const name = str(profile.name);

  if (!name) {
    return { ok: false, code: 'dealer-not-found' };
  }

  return { ok: true, name, approved: readApproved(record, registration) };
}

type Fetched = { status: number; json?: Record<string, unknown> };

/**
 * A single GET. Returns the status rather than throwing so callers can tell a
 * 404 (no such dealer) from everything else (try again shortly).
 *
 * `source=nobettertime` is REQUIRED on every request. Omit it and Connect does
 * not 400 — it 302s to its own login page, which `redirect: 'manual'` turns
 * into a non-ok response rather than a "successful" fetch of an HTML login form.
 */
async function getJson(
  strapi: Core.Strapi,
  url: string,
  apiKey: string,
): Promise<Fetched> {
  try {
    const response = await fetch(url, {
      headers: { 'X-Caravea-Key': apiKey, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Never read or log the body: Connect's errors echo submitted field names
      // and values, which would put dealer PII into plaintext pm2 logs.
      if (response.status !== 404) {
        strapi.log.warn(`[connect] dealer lookup failed (status=${response.status})`);
      }
      return { status: response.status };
    }

    return { status: response.status, json: obj(await response.json()) };
  } catch (error) {
    // Log a chosen outcome word only — same PII discipline as above.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    strapi.log.warn(
      `[connect] dealer lookup failed (outcome=${timedOut ? 'timeout' : 'network-error'})`,
    );
    return { status: 0 };
  }
}

/** Route 1: the by-id show endpoint. Only ULID `submission_id`s resolve here. */
async function fetchById(
  strapi: Core.Strapi,
  base: string,
  apiKey: string,
  dealerId: string,
): Promise<ConnectDealerLookup> {
  const url =
    `${base}${REGISTRATIONS_PATH}/${encodeURIComponent(dealerId)}?source=nobettertime`;

  const { status, json } = await getJson(strapi, url, apiKey);

  if (status === 404) return { ok: false, code: 'dealer-not-found' };
  if (!json) return { ok: false, code: 'connect-unavailable' };

  return toLookup(obj(json.data));
}

/**
 * Route 2: scan the paginated list for a matching `reference` /
 * `caravea_company_id`. Stops at the first match, so the common case is one
 * request.
 */
async function scanForDealer(
  strapi: Core.Strapi,
  base: string,
  apiKey: string,
  dealerId: string,
): Promise<ConnectDealerLookup> {
  let lastPage = 1;

  for (let page = 1; page <= Math.min(lastPage, MAX_SCAN_PAGES); page++) {
    const url =
      `${base}${REGISTRATIONS_PATH}` +
      `?source=nobettertime&per_page=${SCAN_PAGE_SIZE}&page=${page}`;

    const { json } = await getJson(strapi, url, apiKey);
    if (!json) return { ok: false, code: 'connect-unavailable' };

    const meta = obj(json.meta);
    if (typeof meta.last_page === 'number' && meta.last_page > 0) {
      lastPage = meta.last_page;
    }

    const records = Array.isArray(json.data) ? json.data.map(obj) : [];
    for (const record of records) {
      const { registration } = normalise(record);
      if (identifiers(record, registration).includes(dealerId)) {
        return toLookup(record);
      }
    }
  }

  if (lastPage > MAX_SCAN_PAGES) {
    // A capped scan that found nothing is NOT the same as a genuine miss —
    // reporting not-found here would tell a visitor their dealer does not exist
    // when we simply stopped looking. Deny as unavailable instead.
    strapi.log.warn(
      `[connect] dealer scan capped at ${MAX_SCAN_PAGES} pages; Connect reports ${lastPage}`,
    );
    return { ok: false, code: 'connect-unavailable' };
  }

  return { ok: false, code: 'dealer-not-found' };
}

/**
 * `dealerId` is whatever /find-dealer put on the card: a `reference` from the
 * current list shape, or a `submission_id` from a page cached before Connect's
 * redeploy. References contain a `|`, which no ULID does, so the format picks
 * the cheaper route without a wasted round trip.
 */
export async function fetchConnectDealer(
  strapi: Core.Strapi,
  dealerId: string,
): Promise<ConnectDealerLookup> {
  const baseUrl = process.env.CONNECT_API_URL;
  const apiKey = process.env.CONNECT_API_KEY;

  // Read env INSIDE the function, never at module scope — a module-scope throw
  // here would break Strapi's content-type loading on every environment that
  // does not set these.
  if (!baseUrl || !apiKey) {
    return { ok: false, code: 'connect-disabled' };
  }
  if (!dealerId) {
    return { ok: false, code: 'dealer-not-found' };
  }

  const base = baseUrl.replace(/\/+$/, '');

  if (!dealerId.includes('|')) {
    const direct = await fetchById(strapi, base, apiKey, dealerId);

    // Only a genuine 404 falls through to the scan. An unreachable Connect is
    // returned as-is rather than retried a second way — the enquiry is denied
    // either way, and retrying would double the delay the visitor waits for it.
    if (direct.ok || direct.code !== 'dealer-not-found') {
      return direct;
    }
  }

  return scanForDealer(strapi, base, apiKey, dealerId);
}
