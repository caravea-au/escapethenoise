/**
 * Address -> coordinates, via Nominatim (OpenStreetMap).
 *
 * This is the SINGLE SOURCE OF TRUTH for the geocoding heuristics. They were
 * developed against the real dealer data in scripts/geocode-dealers.mjs, which
 * now calls the HTTP endpoint backed by this module rather than keeping a
 * second copy. If you change a heuristic here, re-check it against the known
 * values that shipped in the original dealer-geocodes.json import.
 *
 * Nominatim policy — non-negotiable, breaking these gets the IP blocked:
 *   * 1 request per second, hard. Every call goes through `enqueue` below, which
 *     serialises them process-wide and spaces them RATE_MS apart. The limit is
 *     per source IP and every concurrent form user shares this server's IP, so
 *     per-request pacing would NOT be enough. Never Promise.all this.
 *   * A real identifying User-Agent is mandatory.
 *   * Results are ODbL: storable WITH attribution. Any UI rendering these
 *     coordinates must keep showing "© OpenStreetMap contributors".
 *
 * Do NOT geocode with Mapbox: its standard Geocoding API forbids storing
 * results (only the paid Permanent endpoint allows it). The Mapbox token in
 * this project is for tiles only.
 */

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  'nobettertime-dealer-directory/1.0 (christian.hayag@caravea.au)';

const RATE_MS = 1100;

// place_rank 30 = house/building, 26-27 = road. Anything coarser (suburb,
// town) is only as good as a centroid, so it is labelled approximate and
// distance labels keep their "~".
const STREET_RANK = 26;

// Unlike the offline batch script, this runs on a request path: a hanging
// Nominatim would hold the serial queue and stall every dealer filling in the
// form. Fail fast instead and let them submit without a pin.
const FETCH_TIMEOUT_MS = 5000;

// Bounded so a public endpoint can't grow it without limit. Addresses don't
// move, so there is no TTL — a process restart is the only invalidation.
const CACHE_MAX = 500;

export type GeocodePrecision = 'street' | 'approx';

export type GeocodeAddressInput = {
  street?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  precision: GeocodePrecision;
  /** The OpenStreetMap display_name that answered. Kept so a pin that looks wrong can be diagnosed by reading it rather than re-querying. */
  matchedAddress: string;
  /** The address string we actually queried. Stored so a later address edit can be detected as making the coordinate stale. */
  geocodedAddress: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── rate limiting ────────────────────────────────────────────────────────────

let queueTail: Promise<void> = Promise.resolve();

/**
 * Serialises every outbound Nominatim call process-wide and spaces them
 * RATE_MS apart. Concurrent callers queue behind each other, so a caller on a
 * busy day may wait a few seconds — the UI needs a pending state.
 */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const scheduled = queueTail.then(job);
  // Space the next job RATE_MS after this one settles, and swallow the outcome
  // so one caller's failure never poisons the chain for everyone behind it.
  queueTail = scheduled.then(
    () => sleep(RATE_MS),
    () => sleep(RATE_MS),
  );
  return scheduled;
}

// ── heuristics ───────────────────────────────────────────────────────────────

// Street-type and unit words carry no location information on their own —
// "Road" matching "Road" proves nothing about whether we found the right road.
const GENERIC_STREET_WORDS = new Set([
  'st', 'street', 'rd', 'road', 'ave', 'avenue', 'dr', 'drive', 'hwy', 'highway',
  'ct', 'court', 'pl', 'place', 'cres', 'crescent', 'cl', 'close', 'way', 'pde',
  'parade', 'blvd', 'boulevard', 'tce', 'terrace', 'lane', 'ln', 'esp',
  'esplanade', 'cct', 'circuit', 'grove', 'square', 'sq', 'unit', 'shop', 'lot',
  'suite', 'factory', 'north', 'south', 'east', 'west', 'the', 'and', 'australia',
]);

/**
 * Normalises a free-text street field into something Nominatim's structured
 * `street` param can actually match. Real data here includes "Unit 1, 9 Maxwell
 * Place", "4/11 Kelly Court" and "12 Airport Dr, Kensington QLD 4670, Australia".
 * Strips a leading unit/shop designator, takes the sub-address after a slash,
 * and drops everything after the first comma (which is where dealers repeat the
 * suburb/state/postcode and derail the query).
 */
export function cleanStreet(street: unknown): string {
  let s = String(street ?? '').trim();
  s = s.replace(
    /^\s*(?:unit|u|shop|suite|ste|factory|lot|building|bldg)\s*\.?\s*[\w-]+\s*[,/]\s*/i,
    '',
  );
  s = s.split(',')[0];
  s = s.replace(/^\s*[\w-]+\s*\/\s*/, ''); // "4/11 Kelly Court" -> "11 Kelly Court"
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Did we land on the road we actually asked for? Nominatim silently falls back
 * to *a* road in the right suburb when it can't find the one requested — e.g.
 * "9 Maxwell Place, Narellan" came back as "Queen Street, Narellan", which is
 * road-level but the wrong road. Requires at least one distinctive word from
 * the dealer's street to appear in the matched name before we call it precise.
 */
export function matchedTheRightStreet(
  street: unknown,
  displayName: string,
): boolean {
  const target = displayName.toLowerCase();
  const words = (
    cleanStreet(street).toLowerCase().match(/[a-z]{3,}/g) ?? []
  ).filter((w) => !GENERIC_STREET_WORDS.has(w));
  if (!words.length) return false;
  return words.some((w) => target.includes(w));
}

/** Canonical single-line form of an address, used as the cache key and stored as `geocodedAddress`. */
export function composeAddress(input: GeocodeAddressInput): string {
  const { street, suburb, state, postcode } = input;
  return [street, suburb, state, postcode]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ');
}

// ── network ──────────────────────────────────────────────────────────────────

type NominatimHit = {
  lat?: string;
  lon?: string;
  place_rank?: string | number;
  display_name?: string;
};

/** One Nominatim call with a small retry/backoff. Returns the first result or null. Never throws. */
async function query(url: string, label: string): Promise<NominatimHit | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await enqueue(() =>
        fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-AU' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }),
      );
      if (res.status === 429 || res.status >= 500) {
        // Back off inside the queue: everyone behind us shares the IP that is
        // being throttled, so they must wait too.
        await enqueue(() => sleep(RATE_MS * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as unknown;
      return Array.isArray(json) && json.length
        ? (json[0] as NominatimHit)
        : null;
    } catch (error) {
      if (attempt === 2) {
        strapi.log.warn(
          `[geocode-address] ${label}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await enqueue(() => sleep(RATE_MS * (attempt + 1)));
    }
  }
  return null;
}

// ── public API ───────────────────────────────────────────────────────────────

const cache = new Map<string, GeocodeResult | null>();

function readCache(key: string): { hit: true; value: GeocodeResult | null } | { hit: false } {
  if (!cache.has(key)) return { hit: false };
  return { hit: true, value: cache.get(key) ?? null };
}

function writeCache(key: string, value: GeocodeResult | null): void {
  if (cache.size >= CACHE_MAX) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
}

/**
 * Geocodes an Australian street address.
 *
 * Three-tier ladder: structured street query, then freeform, then suburb +
 * postcode. Note `state` is deliberately absent from the structured query —
 * Nominatim wants full state names and returns [] for "VIC", and AU postcodes
 * are nationally unique so it adds nothing.
 *
 * Returns null when nothing resolves. NEVER throws: the caller must be able to
 * degrade to "no pin" rather than to an error.
 */
export async function geocodeAddress(
  input: GeocodeAddressInput,
  label = 'address',
): Promise<GeocodeResult | null> {
  const geocodedAddress = composeAddress(input);
  if (!geocodedAddress) return null;

  const cacheKey = geocodedAddress.toLowerCase();
  const cached = readCache(cacheKey);
  if (cached.hit) return cached.value;

  const { street, suburb, state, postcode } = input;
  const enc = encodeURIComponent;
  const base =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=au';

  const cleaned = cleanStreet(street);
  const tiers: { tier: string; url: string }[] = [];
  if (cleaned && suburb) {
    tiers.push({
      tier: 'street',
      url: `${base}&street=${enc(cleaned)}&city=${enc(String(suburb))}${
        postcode ? `&postalcode=${enc(String(postcode))}` : ''
      }`,
    });
  }
  if (cleaned) {
    tiers.push({
      tier: 'freeform',
      url: `${base}&q=${enc(
        [
          cleaned,
          [suburb, state, postcode].filter(Boolean).join(' '),
          'Australia',
        ]
          .filter(Boolean)
          .join(', '),
      )}`,
    });
  }
  if (suburb || postcode) {
    tiers.push({
      tier: 'suburb',
      url: `${base}&q=${enc(
        `${[suburb, state, postcode].filter(Boolean).join(' ')}, Australia`,
      )}`,
    });
  }

  for (const { tier, url } of tiers) {
    const hit = await query(url, label);
    if (!hit) continue;

    const lat = Number(Number(hit.lat).toFixed(6));
    const lng = Number(Number(hit.lon).toFixed(6));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const result: GeocodeResult = {
      lat,
      lng,
      // Three conditions, all required, because each catches a different way a
      // result can look better than it is: the tier must have actually carried
      // the street; the result must be road-level or finer; and it must be the
      // road we asked for, not Nominatim's same-suburb fallback.
      precision:
        tier !== 'suburb' &&
        Number(hit.place_rank) >= STREET_RANK &&
        matchedTheRightStreet(street, hit.display_name ?? '')
          ? 'street'
          : 'approx',
      matchedAddress: hit.display_name ?? '',
      geocodedAddress,
    };
    writeCache(cacheKey, result);
    return result;
  }

  // Negative-cache a miss too, so an unresolvable address isn't re-queried on
  // every blur while the dealer edits the rest of the form.
  writeCache(cacheKey, null);
  return null;
}
