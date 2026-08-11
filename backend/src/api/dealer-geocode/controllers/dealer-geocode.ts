/**
 * dealer-geocode controller
 *
 * Exposes address -> coordinates lookup so the public dealer onboarding form can
 * show a dealer a pin on their own building and let them correct it.
 *
 * Two routes, one handler (see routes/geocode-address.ts):
 *   * POST /geocode-address          public, IP rate-limited — the onboarding form
 *   * POST /dealer-geocodes/resolve  API token required, no IP limit — scripts
 *
 * The split is deliberate. Detecting "is this caller holding a valid API token"
 * from inside a route declared `auth: false` means reaching into Strapi's auth
 * internals; a separate route with default auth lets Strapi answer that question
 * for us, and makes the privileged path obvious to anyone auditing this file.
 *
 * WHY the public route needs a rate limit at all: without one this is a free,
 * unauthenticated, unlimited geocoding proxy sitting in front of Nominatim, on
 * OUR server's IP. Abuse gets that IP blocked and takes the whole dealer
 * directory's geocoding down with it.
 */

import { factories } from '@strapi/strapi';
import { geocodeAddress, GeocodeBusyError } from '../../../utils/geocode-address';
import { hashIp } from '../../../utils/hash-ip';

const GEOCODE_UID = 'api::dealer-geocode.dealer-geocode';

// A dealer legitimately geocodes once when their address is complete, plus a
// few times if they correct it. 30 per 10 minutes is generous for a human and
// useless for scraping.
const RATE_LIMIT_PER_IP = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// In-memory, so it resets on restart and is per-process. That is fine here:
// there is one pm2 process, and unlike dealer-enquiry (which counts rows it is
// already writing) this endpoint writes nothing, so a DB-backed counter would
// mean adding writes to a read-only path purely to police it.
//
// This is a per-IP FAIRNESS control, not the abuse ceiling. Koa derives the
// client IP from X-Forwarded-For, so a direct caller can rotate it freely, and
// the API's CORS policy lets any origin drive this endpoint from its own
// visitors' real browsers. The hard ceiling on outbound Nominatim calls lives in
// utils/geocode-address.ts (GLOBAL_MAX_PER_MIN) and does not depend on the
// client's identity at all.
const ipHits = new Map<string, number[]>();

// Hard cap on distinct tracked IPs. Insertion-ordered eviction keeps this O(1)
// per request: an earlier version only deleted entries older than the window,
// so a flood of FRESH distinct IPs pruned nothing and left a full-map scan
// running on every subsequent request. Strapi is single-threaded, so that scan
// was event-loop block time for the entire site's API.
const IP_MAP_MAX = 5000;

// Prune interval, deliberately off the request path.
const IP_PRUNE_MS = 60_000;

const MAX_LENGTHS = {
  street: 200,
  suburb: 100,
  state: 8,
  postcode: 8,
};

/**
 * Trims, strips control/format characters, collapses whitespace and caps
 * length. Returns '' for anything non-string. `\p{C}` is the Unicode "Other"
 * category (control, format, surrogate, unassigned), which covers newline
 * injection and invisible-character padding without hand-listing code points.
 */
const cleanPart = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') return '';
  // Slice BEFORE the regex passes, not after. Running two full-string regexes
  // over an unbounded body and only then truncating to 200 chars let a ~700KB
  // payload burn tens of milliseconds of event loop per request, which slowed
  // every other API route on the site. The generous head-room multiplier keeps
  // multi-byte and whitespace-collapsing cases intact.
  return value
    .slice(0, maxLength * 4)
    .replace(/\p{C}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

/** Drops IP buckets with no hits inside the window. Runs on a timer, never on a request. */
function pruneIpHits(): void {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [k, times] of ipHits) {
    if (!times.length || times[times.length - 1] < cutoff) ipHits.delete(k);
  }
}

// unref so this timer can never hold the process open on shutdown.
const pruneTimer = setInterval(pruneIpHits, IP_PRUNE_MS);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

/** True when this IP has spent its allowance. O(1) amortised. */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  const recent = (ipHits.get(key) ?? []).filter((t) => t >= cutoff);
  if (recent.length >= RATE_LIMIT_PER_IP) {
    ipHits.set(key, recent);
    return true;
  }
  recent.push(now);

  // Refresh insertion order so an active IP is not the next one evicted.
  ipHits.delete(key);
  ipHits.set(key, recent);

  // Hard cap, evicting oldest-inserted first. Unlike a window-based prune this
  // always makes room, so a flood of fresh IPs cannot grow the map.
  while (ipHits.size > IP_MAP_MAX) {
    const oldest = ipHits.keys().next();
    if (oldest.done) break;
    ipHits.delete(oldest.value);
  }
  return false;
}

/**
 * Shared body of both routes. Always resolves with a 200 and `{ data: null }`
 * when nothing resolves — including when Nominatim itself is down. The form
 * must degrade to "no pin", never to an error that makes a dealer think their
 * submission failed.
 */
async function handleLookup(ctx): Promise<void> {
  const body = ctx.request.body as { data?: Record<string, unknown> } | undefined;
  // Accept both `{ data: {...} }` (Strapi convention) and a bare object, so a
  // curl one-liner during QA doesn't need the wrapper.
  const raw = (body?.data ?? body ?? {}) as Record<string, unknown>;

  const input = {
    street: cleanPart(raw.street, MAX_LENGTHS.street),
    suburb: cleanPart(raw.suburb, MAX_LENGTHS.suburb),
    state: cleanPart(raw.state, MAX_LENGTHS.state),
    postcode: cleanPart(raw.postcode, MAX_LENGTHS.postcode),
  };

  // Nothing to work with. Not an error: the form calls this as soon as the
  // address block looks complete, and a partial address is normal.
  if (!input.street && !input.suburb && !input.postcode) {
    ctx.body = { data: null };
    return;
  }

  try {
    const result = await geocodeAddress(input, input.suburb || input.postcode);
    ctx.body = { data: result };
  } catch (error) {
    if (error instanceof GeocodeBusyError) {
      // Load shedding, not a failed lookup. Answer 429 so the client can tell
      // "try again shortly" apart from "that address doesn't exist".
      return ctx.tooManyRequests('Busy. Try again shortly.', {
        code: 'rate-limited',
      });
    }
    // geocodeAddress is written not to throw, but a public endpoint should not
    // depend on that promise. Never surface the upstream error text: it can
    // carry the outbound URL and Nominatim's own diagnostics.
    strapi.log.warn(
      `[dealer-geocode] lookup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    ctx.body = { data: null };
  }
}

export default factories.createCoreController(GEOCODE_UID, () => ({
  /** Public, IP rate-limited. Called by the dealer onboarding form. */
  async geocodeAddress(ctx) {
    const ipKey = hashIp(ctx);
    if (isRateLimited(ipKey)) {
      return ctx.tooManyRequests('Too many lookups. Try again shortly.', {
        code: 'rate-limited',
      });
    }
    return handleLookup(ctx);
  },

  /**
   * API-token only, no IP limit. Used by scripts/geocode-dealers.mjs to fill
   * coordinate gaps in bulk. Same logic, same Nominatim pacing: the serial
   * queue in utils/geocode-address.ts is process-wide, so a script cannot
   * outrun the 1 req/sec policy even on this route.
   */
  async resolveAddress(ctx) {
    return handleLookup(ctx);
  },
}));
