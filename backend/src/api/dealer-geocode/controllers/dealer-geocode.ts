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
import { geocodeAddress } from '../../../utils/geocode-address';
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
const ipHits = new Map<string, number[]>();

// Stops a distributed flood from growing the map without bound.
const IP_MAP_MAX = 5000;

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
  return value
    .replace(/\p{C}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

/** True when this IP has spent its allowance. Prunes as it goes. */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  if (ipHits.size > IP_MAP_MAX) {
    for (const [k, times] of ipHits) {
      if (!times.length || times[times.length - 1] < cutoff) ipHits.delete(k);
    }
  }

  const recent = (ipHits.get(key) ?? []).filter((t) => t >= cutoff);
  if (recent.length >= RATE_LIMIT_PER_IP) {
    ipHits.set(key, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(key, recent);
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
