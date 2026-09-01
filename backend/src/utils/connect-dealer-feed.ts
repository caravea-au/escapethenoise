/**
 * Caravea Connect dealer feed — read and map.
 *
 * THE ONLY PLACE the Connect dealer shape is understood. It used to live in
 * `frontend/src/lib/connect.ts`, read live on every /find-dealer render; the
 * frontend now reads Strapi and this module is what fills Strapi (see
 * `api/integration/services/dealer-sync.ts`). Do not write a second copy — the
 * 2026-08-17 outage was two readers, one of which had not been taught the new
 * shape.
 *
 * Everything mapped here reaches the browser eventually: the `dealer`
 * collection is served by /api/dealers and handed whole to a client island. So
 * `toDealerRecord` builds a FRESH object field by field and never spreads a
 * Connect record — `owner_email`, `abn`, `legal_name`, `leads_email`,
 * `sms_number`, the submitter contact block, licence numbers and the consent
 * flags all sit in the response we read, and none of them may be stored, let
 * alone published. That is also why there is no raw-payload column on the
 * `dealer` collection: the baseplate's inventory cache keeps `rawDetail`, and
 * doing the same here would copy dealer PII into a second table for nothing.
 *
 * Bounded timeout, `redirect: 'manual'`, and never logs a response body:
 * Connect's error paths echo submitted values, which on this endpoint means
 * dealer PII in plaintext pm2 logs.
 */

import { isTrustedMediaUrl } from './trusted-media-url';

const REGISTRATIONS_PATH = '/api/public/dealer-registrations';

// Connect honours `per_page` since its 2026-08-17 redeploy: default 10, ceiling
// 100 (`per_page=200` → 422). `limit` / `page_size` / `pageSize` are ignored and
// fall through to 10, so the parameter NAME is load-bearing. At 100 the current
// ~119 registrations read in 2 requests instead of 12.
const PAGE_SIZE = 100;

// Runaway guard (2,000 dealers). A cap is not a truncation to hide: the sync
// treats a capped read as a failure, because a partial feed looks exactly like
// a feed where everything after page 20 was deleted.
const MAX_PAGES = 20;

// Longer than the 5s used on the request-path lookups — this runs in a cron
// task, not while a visitor waits, and a slow-but-working Connect is much
// better than a failed sweep.
const REQUEST_TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;

// ── readers ──────────────────────────────────────────────────────────────────
// Connect's tree is read defensively at every level: a missing branch yields an
// empty object rather than throwing, so one malformed record can never take the
// whole sweep down.

function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Connect serialises decimals as STRINGS (`"-37.82530000"`), so a
 * `typeof value === 'number'` guard silently drops every coordinate.
 */
function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(str).filter((item): item is string => item !== null);
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * `established` is a plain integer year on Connect, but one real row in our own
 * data carries `25`. Anything outside a sane range reads as absent rather than
 * being rendered as a year.
 */
function establishedYear(value: unknown): number | null {
  const parsed = num(value);
  if (parsed === null) return null;
  const year = Math.trunc(parsed);
  return year >= 1800 && year <= new Date().getFullYear() ? year : null;
}

/**
 * Trading hours come back on `information.trading_hours` as the structured
 * day-keyed object we originally sent.
 *
 * `company.open_hours` is a DIFFERENT field holding rendered HTML
 * (`"<p>Monday: 8:30-17:00</p>"`). It is never read here and must never be:
 * storing Connect-authored HTML and printing it on the page is stored XSS.
 */
function tradingHours(value: unknown): Json | null {
  const parsed = obj(value);
  return Object.keys(parsed).length > 0 ? parsed : null;
}

const STOCK_CONDITIONS = ['New', 'Used', 'Both'] as const;

function stockCondition(value: unknown): 'New' | 'Used' | 'Both' | null {
  const parsed = str(value);
  return STOCK_CONDITIONS.find((c) => c === parsed) ?? null;
}

/**
 * `state` is an ENUMERATION on the dealer collection, so this cannot be a
 * pass-through. Connect's `location.state_province` is free text populated by
 * whatever their importer was handed, and writing "Victoria" (or a lorem
 * string) into an enum column makes Strapi reject the whole record — which
 * would turn one bad row into a sync error rather than a dealer with no state.
 *
 * Anything unrecognised reads as null, and a dealer with no state is correctly
 * excluded from the directory by `participatingDealers` on the frontend: it
 * cannot be in a participating state, and a card no tile or count can account
 * for is worse than an absent one.
 */
const STATES: Record<string, string> = {
  vic: 'VIC', victoria: 'VIC',
  nsw: 'NSW', 'new south wales': 'NSW',
  qld: 'QLD', queensland: 'QLD',
  sa: 'SA', 'south australia': 'SA',
  wa: 'WA', 'western australia': 'WA',
  tas: 'TAS', tasmania: 'TAS',
  nt: 'NT', 'northern territory': 'NT',
  act: 'ACT', 'australian capital territory': 'ACT',
};

function normaliseState(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  return STATES[raw.toLowerCase().replace(/\s+/g, ' ')] ?? null;
}

// ── the match key ────────────────────────────────────────────────────────────

/**
 * TLD-insensitive domain stem: `https://www.example.com.au/dealers` → `example`.
 *
 * TLD-insensitive on purpose — the same dealership appears as
 * `crusadercaravansmelbourne.com.au` in one system and `.com` in the other, and
 * an exact-host comparison misses it. Tolerant of the ~189 scheme-less values in
 * this data (`www.example.com.au`), which `new URL()` cannot parse.
 *
 * Both scheme strips are load-bearing. The second one exists because a real
 * cached dealer carries `https//portmacquariecaravans.com.au`, a colon short of
 * a URL, and without it the stem reads `https`, which is not a domain and is
 * shared by every other value mistyped the same way. The `http`/`https` reject
 * below catches whatever malformation is not anticipated here: a record with no
 * usable stem is skipped, which is recoverable, where a record silently keyed on
 * `https` merges two dealerships into one listing, which is not.
 */
export function domainStem(website: unknown): string | null {
  const raw = String(website ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/*/, '')
    .replace(/^https?\/+/, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/^www\./, '');
  const stem = host.split('.')[0];
  if (!stem || stem.length < 3 || stem === 'http' || stem === 'https') return null;
  return stem;
}

/** Lowercase alphanumerics only, so `Hamilton North` and `HAMILTON NORTH` are one suburb. */
const normaliseSuburb = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * The match key we derive when Connect supplies none of its own (ETN-014).
 *
 * Connect populated `reference` on 2026-08-17, when this mapper was written
 * against it, and regressed to null shortly after. Eleven days later every one
 * of 196 records still carried `reference: null`, `caravea_company_id: null` and
 * no `submission_id` at all, so every record failed to map and the directory
 * froze on its go-live seed with a 38-dealer backlog. Connect populating a real
 * id remains the fix that matters and is still outstanding with them; this is
 * what stops us being blocked on it.
 *
 * Domain plus suburb, measured over the real 196 rather than chosen: it yields
 * 193 distinct keys, and all three collisions are one dealership that submitted
 * twice (Ballarat City Caravans, Prestige Jayco Bendigo, Torus RV, each pair
 * same domain, same street, days apart), so every collision here COLLAPSES a
 * duplicate rather than merging two businesses. Postcode was the alternative and
 * is worse: Connect stores postcodes as integers, so Darwin's `0829` arrives as
 * `829` and that dealer would never be recognised again.
 *
 * The residual risk, accepted with zero instances in the feed today: two
 * branches of one chain in the SAME suburb would share a key and merge into one
 * listing. Ezytrail already has five locations sharing `ezytrail.com.au` and all
 * five are in different suburbs.
 *
 * Prefixed `dz|` so a derived key is distinguishable at a glance from one
 * Connect issued, in SQL and in the admin, exactly as the go-live seed's
 * `seed|` refs are.
 */
export function derivedConnectRef(website: unknown, suburb: unknown): string | null {
  const stem = domainStem(website);
  const locality = normaliseSuburb(suburb);
  // Half a key is worse than none: it would match some other half-keyed dealer.
  if (!stem || !locality) return null;
  return `dz|${stem}|${locality}`;
}

// ── response shape ───────────────────────────────────────────────────────────

/**
 * Connect ships TWO shapes and both are read, because its own two endpoints
 * disagree with each other:
 *
 *   OLD (nested) — still what `GET /dealer-registrations/{submission_id}`
 *   returns:
 *     { submission_id, status, company: { reference, status, approved_at,
 *         company: {…profile}, location: {…}, information: {…} } }
 *
 *   NEW (flat) — what `GET /dealer-registrations` has returned since Connect's
 *   2026-08-17 redeploy. The `company` wrapper collapsed up one level and
 *   `submission_id` disappeared entirely:
 *     { reference, caravea_company_id, status, approved_at,
 *       company: {…profile}, location: {…}, information: {…} }
 *
 * The tell is `company.company`: an object there means the old wrapper is still
 * present. A structural check rather than a version flag, because Connect ships
 * neither — and it degrades safely: an unrecognised third shape yields no id
 * and no name, which `toDealerRecord` turns into a skipped record and the sync
 * turns into a loud failure that writes nothing.
 */
type NormalisedRecord = {
  submissionId: string | null;
  reference: string | null;
  registration: Json;
  profile: Json;
  location: Json;
  information: Json;
};

function normaliseRecord(record: Json): NormalisedRecord {
  const wrapper = obj(record.company);
  const isNested = wrapper.company !== undefined && !Array.isArray(wrapper.company);
  const registration = isNested ? wrapper : record;

  return {
    // Kept separately, unlike the old frontend mapper which collapsed them into
    // one `id`. `reference` is the stable match key for the cache;
    // `submission_id` is the only id Connect's by-id show endpoint accepts, so
    // it is worth storing when present even though nothing reads it today.
    submissionId: str(record.submission_id),
    reference: str(registration.reference) ?? str(registration.caravea_company_id),
    registration,
    profile: obj(isNested ? wrapper.company : record.company),
    location: obj(registration.location),
    information: obj(registration.information),
  };
}

/**
 * Whether Connect has approved this dealer. Drives the `✓ Accredited` badge
 * and NOTHING ELSE — visibility is the Strapi publish toggle, and the enquiry
 * form shows for approved and unapproved dealers alike (ETN-006, ETN-010).
 *
 * Connect is still adding an explicit approval boolean to the read shape
 * (absent across all 119 records on 2026-08-17), so each name it could
 * plausibly ship as is checked first, then the fallback to what the tree
 * exposes today: `status` (currently `"pending"` on every record) and
 * `approved_at` (null on every record). Unreadable state reads as NOT approved.
 */
function isApproved(record: Json, registration: Json): boolean {
  for (const key of ['approved', 'is_approved', 'isApproved']) {
    const explicit = bool(registration[key]) ?? bool(record[key]);
    if (explicit !== null) return explicit;
  }

  const status = str(registration.status) ?? str(record.status);
  if (status) return status.toLowerCase() === 'approved';

  return (str(registration.approved_at) ?? str(record.approved_at)) !== null;
}

// ── mapping ──────────────────────────────────────────────────────────────────

/**
 * One Connect registration, mapped to the columns of the `dealer` collection.
 *
 * The coordinate columns are NOT here. Connect's own coordinates are carried on
 * `connectLatitude`/`connectLongitude` as one *candidate* among several, and
 * the sync decides which pin actually wins — coordinates are the one thing this
 * cache owns locally rather than mirroring.
 */
export type ConnectDealerRecord = {
  connectRef: string;
  connectSubmissionId: string | null;
  dealershipName: string;

  street: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;

  phone: string | null;
  website: string | null;
  description: string | null;

  logo: string | null;
  photos: string[];

  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  googleProfile: string | null;

  tradingHours: Json | null;

  services: string[];
  servicesOther: string | null;
  brands: string[];
  brandsOther: string | null;
  productTypes: string[];
  productsOther: string | null;
  stockCondition: 'New' | 'Used' | 'Both' | null;

  financeAvailable: boolean | null;
  deliveryAvailable: boolean | null;
  rvmapBadged: boolean | null;
  rvmasterBadged: boolean | null;
  established: number | null;
  multipleLocations: boolean | null;
  stateAssociation: string | null;

  approved: boolean;

  /** Connect's own coordinate, a candidate only. Always approximate — see the sync. */
  connectLatitude: number | null;
  connectLongitude: number | null;
};

/** Returns null for a record with no usable identity, so a half-formed row is skipped rather than cached as a blank card. */
export function toDealerRecord(record: Json): ConnectDealerRecord | null {
  const { submissionId, reference, registration, profile, location, information } =
    normaliseRecord(record);

  // A record without a match key cannot be cached at all: there would be no way
  // to recognise it again on the next sweep, and it would be re-created as a
  // duplicate every 10 minutes.
  //
  // Ordered by how much the key is OURS. `reference` is Connect's own id in
  // their key space and always wins; `submission_id` covers anything still
  // arriving in the old nested shape; the derived key is the floor, and exists
  // only because all three of Connect's ids have read null since 2026-08-21.
  // Leaving `reference` first is what makes the fallback self-healing: the
  // sweep re-keys onto their id the moment they ship one (see the derived-key
  // reconciliation in `dealer-sync.ts`), with no migration and no second deploy.
  //
  // Derived from the WEBSITE we store, not from `company.domain`. The two carry
  // the same host on all 196 records, but only one of them ends up in a column,
  // and the sync re-keys a cached dealer by recomputing this key from that
  // column, so deriving from a field we do not keep would eventually key a row
  // by something it no longer carries.
  const website = str(profile.website) ?? str(profile.domain);
  const connectRef =
    reference ?? submissionId ?? derivedConnectRef(website, location.city);
  const dealershipName = str(profile.name);
  if (!connectRef || !dealershipName) return null;

  const logo = information.logo_url ?? profile.logo_url;

  return {
    connectRef,
    connectSubmissionId: submissionId,
    dealershipName,

    street: str(location.address),
    suburb: str(location.city),
    state: normaliseState(location.state_province),
    postcode: str(location.postcode),

    phone: str(profile.phone_number),
    website,
    description: str(profile.description),

    // `logo`/`photo_urls` arrive as free-text strings and end up in an <img src>,
    // so host alone is not enough: syd1.digitaloceanspaces.com is DigitalOcean's
    // SHARED regional endpoint used by every Spaces customer in the region.
    // isTrustedMediaUrl pins bucket + root path too.
    logo: isTrustedMediaUrl(logo) ? logo : null,
    photos: strArray(information.photo_urls).filter(isTrustedMediaUrl),

    facebook: str(profile.facebook),
    instagram: str(profile.instagram),
    youtube: str(profile.youtube),
    googleProfile: str(information.google_profile),

    tradingHours: tradingHours(information.trading_hours),

    // `information` carries the full onboarding answers; `profile.services` is a
    // shorter echo of the same list, used only as a fallback.
    services: strArray(information.services ?? profile.services),
    servicesOther: str(information.services_other),
    brands: strArray(information.brands),
    brandsOther: str(information.brands_other),
    productTypes: strArray(information.product_types),
    productsOther: str(information.products_other),
    stockCondition: stockCondition(information.stock_condition),

    financeAvailable: bool(information.finance_available),
    deliveryAvailable: bool(information.delivery_available),
    rvmapBadged: bool(information.rvmap_badged),
    rvmasterBadged: bool(information.rvmaster_badged),
    established: establishedYear(information.established),
    multipleLocations: bool(information.multiple_locations),
    stateAssociation: str(information.state_association),

    approved: isApproved(record, registration),

    connectLatitude: num(location.latitude),
    connectLongitude: num(location.longitude),
  };
}

// ── fetching ─────────────────────────────────────────────────────────────────

export type ConnectFeed = {
  /** Raw records, every page concatenated. */
  records: Json[];
  /** Outbound requests spent, for the sync summary. */
  requests: number;
  /** `meta.total` as Connect reported it, or null if absent. */
  total: number | null;
};

/** Thrown for anything that means "we did not get a complete feed". The sync turns this into a no-op sweep. */
export class ConnectFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectFeedError';
  }
}

export function isConnectConfigured(): boolean {
  // Read env INSIDE the function, never at module scope: a module-scope throw
  // would break Strapi's content-type loading on every environment that does
  // not set these.
  return Boolean(process.env.CONNECT_API_URL && process.env.CONNECT_API_KEY);
}

async function fetchPage(
  base: string,
  apiKey: string,
  page: number,
): Promise<{ records: Json[]; lastPage: number; total: number | null }> {
  // `source=nobettertime` is REQUIRED on every request. Without it Connect does
  // not 400 — it 302s to its own login page, which then "succeeds" as HTML and
  // fails to parse. `redirect: 'manual'` turns that into a non-ok response
  // instead. This is also why `links.next` is never followed: their pagination
  // URLs drop the parameter.
  const url =
    `${base}${REGISTRATIONS_PATH}?source=nobettertime&per_page=${PAGE_SIZE}&page=${page}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'X-Caravea-Key': apiKey, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Log a chosen outcome word only, never the error object: Connect's error
    // paths echo submitted values, which for this endpoint means dealer PII in
    // plaintext pm2 logs.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new ConnectFeedError(
      `page ${page} unreachable (${timedOut ? 'timeout' : 'network-error'})`,
    );
  }

  if (!response.ok) {
    throw new ConnectFeedError(`page ${page} failed (status=${response.status})`);
  }

  let json: Json;
  try {
    json = obj(await response.json());
  } catch {
    throw new ConnectFeedError(`page ${page} was not JSON`);
  }

  const meta = obj(json.meta);
  if (!Array.isArray(json.data)) {
    throw new ConnectFeedError(`page ${page} carried no data array`);
  }

  return {
    records: json.data.map(obj),
    lastPage: Math.max(1, num(meta.last_page) ?? 1),
    total: num(meta.total),
  };
}

/**
 * Every dealer Connect holds for this site, unmapped.
 *
 * THROWS rather than returning a short feed for anything that means the read
 * was incomplete — an unreachable page, a non-JSON body, or more pages than the
 * cap. That distinction is the whole safety story: the sync treats a throw as
 * "change nothing", and a partial feed is indistinguishable from a feed where
 * the missing dealers were deleted.
 */
export async function fetchConnectDealerFeed(): Promise<ConnectFeed> {
  const baseUrl = process.env.CONNECT_API_URL;
  const apiKey = process.env.CONNECT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new ConnectFeedError('Connect is not configured (CONNECT_API_URL / CONNECT_API_KEY)');
  }

  const base = baseUrl.replace(/\/+$/, '');
  const first = await fetchPage(base, apiKey, 1);

  if (first.lastPage > MAX_PAGES) {
    throw new ConnectFeedError(
      `Connect reports ${first.lastPage} pages, above the ${MAX_PAGES}-page cap; refusing a partial feed`,
    );
  }

  const records = [...first.records];
  let requests = 1;

  for (let page = 2; page <= first.lastPage; page++) {
    const next = await fetchPage(base, apiKey, page);
    records.push(...next.records);
    requests += 1;
  }

  return { records, requests, total: first.total };
}
