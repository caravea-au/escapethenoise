/**
 * Caravea Connect inbound mapper — turns a `dealer-submission` row into the
 * POST body for `{CONNECT_API_URL}/api/public/dealer-registrations`.
 *
 * Pure, side-effect-free, zero Strapi imports and zero env reads, so it can
 * be safely imported from the lifecycle hook AND the backfill script without
 * either one dragging in a Strapi runtime. The object is built by explicit
 * assignment only — never by spreading the input — so an unexpected key on
 * the row (Strapi internals, transient form fields) can never leak through.
 *
 * `row` is deliberately typed loosely (`Record<string, unknown>`) because two
 * different callers hand it two different shapes:
 *   - the lifecycle passes a raw DB row (`event.result`), where
 *     `geocodeSource` / `geocodedAddress` genuinely exist as columns;
 *   - the backfill passes a REST-sourced object, where those two can never be
 *     present — `geocodedAddress` is `private: true` and Strapi's
 *     `removePrivate` visitor strips it unconditionally, even with a
 *     full-access token, and the backfill has no separate raw-row source.
 * Every field below is read defensively so either shape maps cleanly; a
 * missing/malformed value is omitted or nulled rather than guessed at.
 */

// A `type` alias, not an `interface`: TypeScript only grants an object type
// an implicit index signature (needed to assign into connect-client.ts's
// `Record<string, unknown>` payload param) when it is declared as a type
// literal, not an interface.
export type ConnectRegistrationPayload = {
  source: 'nobettertime';
  dealershipName: string | null;
  legalName: string | null;
  abn: string | null;
  established: number | null;
  dms: string | null;
  dmsOther: string | null;
  street: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  latitude?: number;
  longitude?: number;
  geocodePrecision?: string;
  geocodeSource: 'nobettertime';
  geocodedAddress?: string;
  motorDealerLicenceName: string | null;
  motorDealerLicenceNumber: string | null;
  phone: string | null;
  leadsEmail: string | null;
  smsNumber: string | null;
  contactName: string | null;
  contactRole: string | null;
  enquiriesEmail: string | null;
  services: unknown[];
  servicesOther: string | null;
  brands: unknown[];
  brandsOther: string | null;
  productTypes: unknown[];
  productsOther: string | null;
  stockCondition: string | null;
  website: string | null;
  description: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  googleProfile: string | null;
  tradingHours: unknown;
  logo: string;
  photos: string[];
  multipleLocations: boolean;
  financeAvailable: boolean;
  deliveryAvailable: boolean;
  rvmapBadged: boolean;
  rvmasterBadged: boolean;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterPhone: string | null;
  stateAssociation: string | null;
  authorised: boolean;
  privacyConsent: boolean;
  marketingConsent: boolean;
  submittedAt: string | null;
  comment: null;
  elapsedMs: null;
};

import { isTrustedMediaUrl } from './trusted-media-url';

const MIN_ESTABLISHED_YEAR = 1800;

/** Trims a string field; empty/whitespace-only and non-strings become `null`. */
function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() === '' ? null : value;
}

/**
 * Same as {@link toStringOrNull}, but also accepts a `Date` (datetime
 * columns). An invalid `Date` (e.g. constructed from an unparseable string
 * upstream) has a `getTime()` of `NaN`, and `.toISOString()` throws
 * `RangeError` on it rather than returning a value — guarded here so one bad
 * row can't throw out of the mapper.
 */
function toIsoStringOrNull(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  return toStringOrNull(value);
}

function toBool(value: unknown): boolean {
  return value === true;
}

/** No de-duplication — see the module comment on `services`/`brands`/`productTypes`. */
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * ABN: strip whitespace only. 64 of 162 real rows contain spaces (Connect's
 * own 422 message says "must be 11 digits" while its own sample payload sends
 * a spaced ABN), so this only removes the ambiguity — it does not otherwise
 * validate or reformat the value.
 */
function normaliseAbn(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\s+/g, '');
  return digits === '' ? null : digits;
}

/**
 * Drops any `established` value outside a sane year range. One real row
 * (Eco-Tourer) has `established: 25`, which 422s against Connect if sent raw.
 */
function normaliseEstablished(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const year = Math.trunc(n);
  const currentYear = new Date().getFullYear();
  if (year < MIN_ESTABLISHED_YEAR || year > currentYear) return null;
  return year;
}

/**
 * `tradingHours` passes through as-is (Connect's own sample shows capitalised
 * day keys, matching ours). Some callers may hand this over as a JSON string
 * (e.g. a REST response that never got auto-parsed), so parse it defensively
 * and fail to `null` rather than forward a raw unparseable string.
 */
function normaliseTradingHours(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Turns a possibly scheme-less, possibly malformed URL-shaped field into a
 * real absolute URL, or `null` on any failure. Never throws.
 *
 * Every branch below is driven by a measured value in the real 162-row
 * dataset, not a hypothetical:
 *   - `" https://g.page/r/CUFFR6LGXXqbEAg/"` — leading space, already has a
 *     scheme. `trim()` must run before the scheme check, or this becomes
 *     `https:// https://g.page/...`.
 *   - `"Snowy River Geelong"`, `"5 star"`, `"Australian Caravan Centre -
 *     YouTube"` — plain text, not a host. Rejected by the whitespace check
 *     before the URL constructor ever sees them.
 *   - two bare email addresses — no whitespace, so they'd otherwise survive
 *     to the URL constructor and, once naively prefixed with `https://`,
 *     parse "successfully" as `https://user@host` with a valid hostname.
 *     Caught explicitly before prefixing.
 *   - `"https//portmacquariecaravans.com.au"` — missing colon. Doesn't match
 *     the scheme regex, so it gets `https://` prefixed onto the front and the
 *     `new URL()` call. Correctly fails the hostname-has-a-dot check.
 *   - 38 of the `youtube` values have no scheme at all — the ordinary case
 *     this whole function exists for.
 */
function normaliseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/\s/.test(trimmed)) return null;

  const hasScheme = /^https?:\/\//i.test(trimmed);

  // Reject anything email-shaped BEFORE ever prefixing a scheme: naively
  // prepending "https://" to "name@host.tld" parses "fine" as a URL with a
  // username and a hostname containing a dot.
  if (!hasScheme && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!url.hostname || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Same as {@link normaliseUrl}, but additionally requires the result to land
 * on the approved DO Spaces media host/path (`isTrustedMediaUrl`, shared with
 * `public-dealer.ts`). `logo`/`photos` are the only two fields Connect fetches
 * server-side, so an SSRF-shaped value (an internal IP, a metadata endpoint, a
 * lookalike hostname) must never reach it — unlike `website`/`facebook`/etc.,
 * which are ordinary links Connect never dereferences.
 */
function normaliseTrustedUrl(value: unknown): string | null {
  const url = normaliseUrl(value);
  return url && isTrustedMediaUrl(url) ? url : null;
}

/** `photos` variant of {@link normaliseTrustedUrl} — untrusted entries drop silently. */
function normaliseTrustedUrlArray(value: unknown): string[] {
  return toArray(value)
    .map((item) => normaliseTrustedUrl(item))
    .filter((item): item is string => Boolean(item));
}

/**
 * Flat rather than a discriminated union on `ok` — same reason as
 * `VerifyRecaptchaResult` in verify-recaptcha.ts: this backend compiles with
 * `strict: false` (backend/tsconfig.json), and without strictNullChecks
 * TypeScript will not narrow a boolean-literal discriminant, so
 * `if (!gate.ok) gate.reason` fails to compile. `reason` is always set when
 * `ok` is false.
 */
export type ConnectPushGateResult = {
  ok: boolean;
  reason?: 'spam' | 'missing-logo' | 'missing-photos';
};

/**
 * Gate a row before it is pushed to Connect. Three independent checks, all
 * must pass:
 *   - `spamSuspect` is `NULL` for most genuine dealers (the heuristics never
 *     fired) and `false` for the rest — only `true` means flagged. Written as
 *     a plain predicate on purpose: `backend/src/utils/dealer-not-spam-filter.ts`
 *     exports a Strapi `where` clause object, not a function, and cannot
 *     filter a plain JS object.
 *   - `logo` must be a non-empty string that survives URL validation AND the
 *     media-host allow-list (`isTrustedMediaUrl`). Confirmed live against
 *     Connect staging: omitting `logo` (or sending an empty value) 422s with
 *     "The logo field is required." Two real rows (JB Caravans, JB Group
 *     Townsville) have no logo and must be skipped, not sent with an
 *     invented placeholder. A row with a logo URL on an untrusted host is
 *     treated the same as a missing logo — see `normaliseTrustedUrl`.
 *   - `photos` must contain at least one URL that survives the same two
 *     checks. Also confirmed live: an empty `photos: []` 422s the same way as
 *     omitting the key. One real row (Caravan HQ Queensland) has no photos
 *     and must be skipped.
 * Returns a reason instead of a plain boolean so the caller can log/report
 * WHY a row was skipped.
 */
export function shouldPushToConnect(row: Record<string, unknown>): ConnectPushGateResult {
  if (row?.spamSuspect === true) return { ok: false, reason: 'spam' };
  if (!normaliseTrustedUrl(row?.logo)) return { ok: false, reason: 'missing-logo' };
  if (normaliseTrustedUrlArray(row?.photos).length === 0) return { ok: false, reason: 'missing-photos' };
  return { ok: true };
}

export function toConnectRegistration(
  row: Record<string, unknown>,
): ConnectRegistrationPayload {
  const payload: ConnectRegistrationPayload = {
    source: 'nobettertime',
    dealershipName: toStringOrNull(row.dealershipName),
    legalName: toStringOrNull(row.legalName),
    abn: normaliseAbn(row.abn),
    established: normaliseEstablished(row.established),
    dms: toStringOrNull(row.dms),
    dmsOther: toStringOrNull(row.dmsOther),

    street: toStringOrNull(row.street),
    suburb: toStringOrNull(row.suburb),
    state: toStringOrNull(row.state),
    postcode: toStringOrNull(row.postcode),

    // Names the SENDING SYSTEM to Connect, not our own provenance column
    // (our enum is geocoded|adjusted|imported|admin — sending it verbatim
    // would ship "imported" for 88% of dealers instead of "nobettertime").
    geocodeSource: 'nobettertime',

    motorDealerLicenceName: toStringOrNull(row.motorDealerLicenceName),
    motorDealerLicenceNumber: toStringOrNull(row.motorDealerLicenceNumber),

    phone: toStringOrNull(row.phone),
    leadsEmail: toStringOrNull(row.leadsEmail),
    smsNumber: toStringOrNull(row.smsNumber),
    contactName: toStringOrNull(row.contactName),
    contactRole: toStringOrNull(row.contactRole),
    enquiriesEmail: toStringOrNull(row.enquiriesEmail),

    services: toArray(row.services),
    servicesOther: toStringOrNull(row.servicesOther),
    brands: toArray(row.brands),
    brandsOther: toStringOrNull(row.brandsOther),
    productTypes: toArray(row.productTypes),
    productsOther: toStringOrNull(row.productsOther),
    stockCondition: toStringOrNull(row.stockCondition),

    website: normaliseUrl(row.website),
    description: toStringOrNull(row.description),
    facebook: normaliseUrl(row.facebook),
    instagram: normaliseUrl(row.instagram),
    youtube: normaliseUrl(row.youtube),
    googleProfile: normaliseUrl(row.googleProfile),

    tradingHours: normaliseTradingHours(row.tradingHours),

    // Both plain URL strings, not Strapi media relations. Connect requires
    // BOTH non-empty (confirmed live: omitting either, or an empty `photos`
    // array, 422s) — callers must gate with `shouldPushToConnect` first;
    // this mapper still normalises defensively rather than assuming that
    // already happened. Connect fetches these server-side, so both are also
    // pinned to the approved media host via `normaliseTrustedUrl`/
    // `normaliseTrustedUrlArray` — an untrusted URL is dropped the same as a
    // missing one, never forwarded.
    logo: normaliseTrustedUrl(row.logo) ?? '',
    photos: normaliseTrustedUrlArray(row.photos),

    multipleLocations: toBool(row.multipleLocations),
    financeAvailable: toBool(row.financeAvailable),
    deliveryAvailable: toBool(row.deliveryAvailable),
    rvmapBadged: toBool(row.rvmapBadged),
    rvmasterBadged: toBool(row.rvmasterBadged),

    submitterName: toStringOrNull(row.submitterName),
    submitterEmail: toStringOrNull(row.submitterEmail),
    submitterPhone: toStringOrNull(row.submitterPhone),
    stateAssociation: toStringOrNull(row.stateAssociation),
    authorised: toBool(row.authorised),
    privacyConsent: toBool(row.privacyConsent),
    marketingConsent: toBool(row.marketingConsent),

    submittedAt: toIsoStringOrNull(row.submittedAt),

    // Neither is a DB column on dealer-submission; a live Connect record
    // confirms nulls are accepted for both.
    comment: null,
    elapsedMs: null,

    // `mediaErrors` is deliberately omitted entirely — our shape differs
    // from Connect's, and the contract doesn't list it as required.
  };

  const geocodedAddress = toStringOrNull(row.geocodedAddress);
  if (geocodedAddress) {
    payload.geocodedAddress = geocodedAddress;
  }

  // Guard on Number.isFinite of the RAW value, never truthiness or a coerced
  // Number(): longitude 0 is a real, falsy value, and Number('') === 0 would
  // otherwise turn an empty string into a fake coordinate.
  if (
    typeof row.latitude === 'number' &&
    typeof row.longitude === 'number' &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude)
  ) {
    payload.latitude = row.latitude;
    payload.longitude = row.longitude;

    const precision = toStringOrNull(row.precision);
    if (precision) {
      payload.geocodePrecision = precision;
    }
  }

  return payload;
}
