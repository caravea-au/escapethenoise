/**
 * Caravea Connect → Strapi dealer cache.
 *
 * ONE job owns the upstream read: this one, on a cron. Never the Next.js build,
 * never the frontend, never a request path. /find-dealer reads the `dealer`
 * collection and nothing else, so an upstream wipe, outage or shape change is a
 * failed sweep in a log rather than an empty client-facing directory.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE, and the reason this is not the baseplate's inventory-sync
 * copied across:
 *
 *   THE SYNC WRITES THE DRAFT AND PUBLISHES ONLY WHAT IS ALREADY PUBLISHED.
 *
 * `caravea-nextjs-baseplate/backend/src/api/integration/services/inventory-sync.ts`
 * calls `publish()` on every UNCHANGED row on every pass (its `unchanged`
 * branches, and `status: 'published'` on every update). Copy either and a
 * dealer a staff member unpublished is silently republished within one cron
 * interval — which is the entire feature this collection exists for. There is
 * no test that would catch it either; it just quietly stops working.
 *
 * Draft/publish on `dealer` is EDITORIAL state, locally owned. Everything else
 * on the row belongs to Connect and is overwritten freely (ETN-013 D2).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Safety rails, each of which is the difference between a cache and a slower
 * outage:
 *
 *  1. An incomplete read changes NOTHING. `fetchConnectDealerFeed` throws
 *     rather than returning a short feed, and a throw here means the sweep
 *     writes nothing at all.
 *  2. A zero-record read is a no-op, logged as a failure. This is not
 *     hypothetical: on 2026-08-20 staging Connect answered `meta.total: 0`, and
 *     because the page treated `[]` as an honestly empty directory, an upstream
 *     wipe rendered as a calm "0 caravan dealers" and nothing alerted.
 *  3. Records in but none mapped is a no-op, logged as a failure — that is a
 *     shape change, not an empty directory. It shipped silently on 2026-08-17.
 *  4. Bulk-disappearance brake: if more than 20% of cached dealers are absent
 *     from one sweep, mark NONE of them and fail for a human to look at.
 *  5. Nothing is ever hard-deleted or unpublished by this job. A dealer who
 *     vanishes upstream is flagged `sourceStatus: missing` and stays listed;
 *     unpublishing would overload the editorial state, and a returning dealer
 *     would then silently resurrect one staff had deliberately hidden.
 *  6. Unchanged dealers cost ZERO writes, so the admin's "Modified" badge means
 *     something and `updatedAt` is not churned every 10 minutes.
 */

import { createHash } from 'node:crypto';
import type { Core } from '@strapi/strapi';

import {
  ConnectFeedError,
  derivedConnectRef,
  domainStem,
  fetchConnectDealerFeed,
  toDealerRecord,
  type ConnectDealerRecord,
} from '../../../utils/connect-dealer-feed';
import { DEALER_NOT_SPAM_FILTER } from '../../../utils/dealer-not-spam-filter';
import { withoutRevalidate } from '../../../utils/revalidate-frontend';

const DEALER_UID = 'api::dealer.dealer';
const SUBMISSION_UID = 'api::dealer-submission.dealer-submission';
const SETTING_UID = 'api::integration-setting.integration-setting';

/** Above this share of the cache missing in one sweep, mark nothing and fail (rail 4). */
const MISSING_BRAKE_RATIO = 0.2;

// ── summary ──────────────────────────────────────────────────────────────────

export type DealerSyncSummary = {
  /** `disabled` is never persisted to lastSyncStatus — nothing ran, so there is no outcome to record. */
  status: 'ok' | 'failed' | 'disabled';
  /** Raw records Connect returned. */
  fetched: number;
  /** Records that carried a usable identity and mapped. */
  mapped: number;
  /** Records dropped because another record in the same feed carried the same connectRef. */
  duplicates: number;
  created: number;
  updated: number;
  /** Cached dealers matched on the derived key and re-keyed onto the ref this sweep carried. */
  rekeyed: number;
  /** Unchanged: no write, no publish, no `updatedAt` churn. */
  skipped: number;
  markedMissing: number;
  /** Previously `missing`, present again in this sweep. */
  returned: number;
  requests: number;
  pins: { street: number; approx: number; none: number };
  /** Dealership names with no coordinate from any source, for hand-resolution. Capped. */
  unpinned: string[];
  errors: string[];
};

/** Bounded so a broken sweep cannot write a megabyte of names into lastSyncSummary. */
const MAX_REPORTED_UNPINNED = 40;

const createSummary = (): DealerSyncSummary => ({
  status: 'ok',
  fetched: 0,
  mapped: 0,
  duplicates: 0,
  created: 0,
  updated: 0,
  rekeyed: 0,
  skipped: 0,
  markedMissing: 0,
  returned: 0,
  requests: 0,
  pins: { street: 0, approx: 0, none: 0 },
  unpinned: [],
  errors: [],
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ── the cached rows ──────────────────────────────────────────────────────────

type Pin = {
  latitude: number | null;
  longitude: number | null;
  precision: 'street' | 'approx' | null;
  geocodeSource: 'geocoded' | 'adjusted' | 'imported' | 'admin' | 'connect' | null;
  matchedAddress: string | null;
  geocodedAddress: string | null;
};

const NO_PIN: Pin = {
  latitude: null,
  longitude: null,
  precision: null,
  geocodeSource: null,
  matchedAddress: null,
  geocodedAddress: null,
};

type CachedDealer = {
  documentId: string;
  /** The ref this row is currently stored under. May be a `seed|` or `dz|` key rather than one Connect issued. */
  connectRef: string;
  /** `dz|stem|suburb` recomputed from this row's own website and suburb, or null if either is unusable. */
  derivedKey: string | null;
  /** Whether a published version of this document exists. The ONLY thing that decides whether the sync may call publish(). */
  hasPublished: boolean;
  sourceHash: string | null;
  sourceStatus: string | null;
  pin: Pin;
};

const PIN_FIELDS = [
  'latitude',
  'longitude',
  'precision',
  'geocodeSource',
  'matchedAddress',
  'geocodedAddress',
] as const;

function readPin(row: Record<string, unknown>): Pin {
  const latitude = typeof row.latitude === 'number' ? row.latitude : null;
  const longitude = typeof row.longitude === 'number' ? row.longitude : null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NO_PIN;

  return {
    latitude,
    longitude,
    precision: (row.precision as Pin['precision']) ?? null,
    geocodeSource: (row.geocodeSource as Pin['geocodeSource']) ?? null,
    matchedAddress: typeof row.matchedAddress === 'string' ? row.matchedAddress : null,
    geocodedAddress: typeof row.geocodedAddress === 'string' ? row.geocodedAddress : null,
  };
}

/**
 * Every cached dealer, keyed by connectRef.
 *
 * `strapi.db.query` rather than the document service, for two reasons. It is
 * not subject to `config/api.ts`'s maxLimit of 100 (there are ~180 dealers, and
 * a silently truncated cache read would look to the brake below exactly like
 * most of the directory having disappeared upstream). And it returns the DRAFT
 * and PUBLISHED rows of each document separately, which is precisely the
 * distinction the publish rule turns on — a draftAndPublish collection stores
 * both in this one table, published version identified by a non-null
 * `publishedAt`.
 */
async function loadCache(strapi: Core.Strapi): Promise<Map<string, CachedDealer>> {
  const rows = (await strapi.db.query(DEALER_UID).findMany({
    select: [
      'documentId',
      'connectRef',
      'sourceHash',
      'sourceStatus',
      'publishedAt',
      // Read only to rebuild the derived match key; neither is written by this query.
      'website',
      'suburb',
      ...PIN_FIELDS,
    ],
  })) as Record<string, unknown>[];

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const ref = typeof row.connectRef === 'string' ? row.connectRef : null;
    if (!ref) continue;
    const bucket = grouped.get(ref);
    if (bucket) bucket.push(row);
    else grouped.set(ref, [row]);
  }

  const cache = new Map<string, CachedDealer>();
  for (const [ref, group] of grouped) {
    // Field values come from the DRAFT row, because the draft is what this sync
    // writes and therefore what carries the newest hash and pin. Falling back to
    // the first row covers the shape Strapi should never produce (a published
    // entry with no draft counterpart); getting a stale hash there only costs
    // one redundant write.
    const source = group.find((row) => !row.publishedAt) ?? group[0];

    cache.set(ref, {
      documentId: String(source.documentId),
      connectRef: ref,
      derivedKey: derivedConnectRef(source.website, source.suburb),
      hasPublished: group.some((row) => Boolean(row.publishedAt)),
      sourceHash: typeof source.sourceHash === 'string' ? source.sourceHash : null,
      sourceStatus: typeof source.sourceStatus === 'string' ? source.sourceStatus : null,
      pin: readPin(source),
    });
  }

  return cache;
}

// ── coordinates ──────────────────────────────────────────────────────────────
// Coordinates are the ONE thing this cache owns rather than mirroring. Connect
// stores no precision field, so every coordinate it sends is approximate by
// construction and every distance label built from one keeps its "~". Our own
// dealer_submissions table, by contrast, holds 175 coordinates of which 155 are
// street-precision: pins dealers placed themselves on the onboarding form, pins
// staff corrected in the admin, and geocodes verified against the right road.
// Throwing those away for Connect's suburb-level guesses would visibly regress
// the map.

/** Higher wins. Ranked by how much we trust the pin, NOT by which system it came from. */
function pinRank(pin: Pin): number {
  if (pin.latitude === null || pin.longitude === null) return 0;
  // A human put this pin here: the dealer dragged it on the onboarding form
  // ('adjusted') or staff corrected it in the admin ('admin'). Outranks any
  // geocode, including a street-precision one.
  if (pin.geocodeSource === 'admin' || pin.geocodeSource === 'adjusted') return 3;
  return pin.precision === 'street' ? 2 : 1;
}

/**
 * Which pin this dealer gets.
 *
 * Precision-ranked rather than source-ranked, which makes it order-independent:
 * there is no "run the migration before the first sync" hazard, and a sweep that
 * happens to see Connect's approximate coordinate first still upgrades to a
 * street pin the moment the submission match is available. Ties go to the pin
 * already cached, so a settled dealer produces no write.
 *
 * KNOWN TRADE-OFF, deliberate: a street-precision pin is never downgraded, so if
 * a dealer MOVES and Connect updates their address, the old street pin keeps
 * winning over Connect's new approximate one. The fix is manual and cheap —
 * clear the coordinate fields on that dealer in the admin and the next sweep
 * re-resolves them. The alternative (comparing addresses to detect staleness)
 * re-resolved constantly on pure formatting differences between the two systems'
 * address strings, which churned the pins it was meant to protect.
 */
function resolvePin(cached: Pin, submission: Pin, connect: Pin): Pin {
  // Order matters only for ties, and encodes "prefer what is already there".
  const candidates = [cached, submission, connect];
  let best = candidates[0];
  let bestRank = pinRank(best);
  for (const candidate of candidates.slice(1)) {
    if (pinRank(candidate) > bestRank) {
      best = candidate;
      bestRank = pinRank(candidate);
    }
  }
  return bestRank === 0 ? NO_PIN : best;
}

/** Connect's own coordinate as a candidate. Always `approx`: Connect has no precision field, so claiming `street` would print a false decimal distance. */
function connectPin(record: ConnectDealerRecord): Pin {
  if (record.connectLatitude === null || record.connectLongitude === null) return NO_PIN;
  return {
    latitude: record.connectLatitude,
    longitude: record.connectLongitude,
    precision: 'approx',
    geocodeSource: 'connect',
    matchedAddress: null,
    geocodedAddress: null,
  };
}

// ── matching Connect dealers to our own onboarding rows ──────────────────────

/** Lowercase alphanumerics only. "Gippsland RV & Marine" and "Gippsland RV and Marine" still differ; this is a normaliser, not a fuzzy matcher. */
const normaliseName = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalisePostcode = (value: unknown): string => String(value ?? '').trim();

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. Mirrors the frontend's haversineKm and dealer-pin.ts. */
function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Two pins this far apart or closer are the same place, so either will do. */
const SAME_PLACE_KM = 0.1;

/**
 * Collects candidate pins per key and reduces each key to at most one pin.
 *
 * A key with several pins is NOT automatically ambiguous, and treating it that
 * way threw away real data: 11 of the 12 duplicated name+postcode groups in this
 * table are the SAME dealership entered twice, agreeing to 0.0000km, and dropping
 * them cost 11 street-precision pins that then fell back to Connect's
 * suburb-level guess or to nothing at all. The 12th genuinely disagrees (Coffs
 * Caravan Company, 1.87km apart, one `approx` and one `street` for the same
 * address written two ways) and the better-precision pin is the right answer
 * there too.
 *
 * So: take the highest-ranked pin. Only give up when two pins of the SAME top
 * rank point at genuinely different places — that is the one case where there is
 * nothing to choose between them and a wrong choice is a dealer on the wrong
 * side of town. This matters most for the website index, where a collision means
 * several LOCATIONS sharing one corporate site (37 of ~161 dealers do), and those
 * are exactly the pins the distance check rejects.
 */
class PinIndex {
  private candidates = new Map<string, Pin[]>();

  add(key: string, pin: Pin): void {
    if (pin.latitude === null) return;
    const bucket = this.candidates.get(key);
    if (bucket) bucket.push(pin);
    else this.candidates.set(key, [pin]);
  }

  resolve(): Map<string, Pin> {
    const resolved = new Map<string, Pin>();

    for (const [key, pins] of this.candidates) {
      const bestRank = Math.max(...pins.map(pinRank));
      const top = pins.filter((pin) => pinRank(pin) === bestRank);
      const first = top[0];

      const disagrees = top.some(
        (pin) =>
          haversineKm(
            [first.latitude as number, first.longitude as number],
            [pin.latitude as number, pin.longitude as number],
          ) > SAME_PLACE_KM,
      );

      if (!disagrees) resolved.set(key, first);
    }

    return resolved;
  }
}

type SubmissionIndex = {
  byNamePostcode: Map<string, Pin>;
  byDomainStem: Map<string, Pin>;
};

/** Coordinates from our own onboarding table, indexed for matching. */
async function loadSubmissionIndex(strapi: Core.Strapi): Promise<SubmissionIndex> {
  const rows = (await strapi.db.query(SUBMISSION_UID).findMany({
    select: ['dealershipName', 'postcode', 'website', ...PIN_FIELDS],
    where: DEALER_NOT_SPAM_FILTER,
  })) as Record<string, unknown>[];

  const byName = new PinIndex();
  const byStem = new PinIndex();

  for (const row of rows) {
    const pin = readPin(row);
    if (pin.latitude === null) continue;

    const name = normaliseName(row.dealershipName);
    if (name) byName.add(`${name}|${normalisePostcode(row.postcode)}`, pin);

    const stem = domainStem(row.website);
    if (stem) byStem.add(stem, pin);
  }

  return { byNamePostcode: byName.resolve(), byDomainStem: byStem.resolve() };
}

/**
 * Our own coordinate for a Connect dealer, if we can be confident it is the same
 * dealership.
 *
 * Name plus postcode first, which is the strong signal. The website stem is the
 * fallback and is only consulted when the stem is unique on BOTH sides — a
 * Connect dealer sharing a corporate website with three siblings must not
 * inherit one sibling's pin.
 */
function matchSubmissionPin(
  record: ConnectDealerRecord,
  index: SubmissionIndex,
  sharedStems: Set<string>,
): Pin {
  const name = normaliseName(record.dealershipName);
  if (name) {
    const hit = index.byNamePostcode.get(`${name}|${normalisePostcode(record.postcode)}`);
    if (hit) return hit;
  }

  const stem = domainStem(record.website);
  if (stem && !sharedStems.has(stem)) {
    const hit = index.byDomainStem.get(stem);
    if (hit) return hit;
  }

  return NO_PIN;
}

/** Domain stems more than one Connect dealer uses. Those dealers get no website-fallback match. */
function sharedConnectStems(records: ConnectDealerRecord[]): Set<string> {
  const seen = new Map<string, number>();
  for (const record of records) {
    const stem = domainStem(record.website);
    if (!stem) continue;
    seen.set(stem, (seen.get(stem) ?? 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([stem]) => stem));
}

// ── matching a feed record to the row that already holds it ──────────────────

/**
 * Which cached dealer each incoming record belongs to.
 *
 * The cache is keyed on `connectRef`, so this used to be one `cache.get`. It is
 * not enough any more, because the ref a record arrives with can legitimately
 * CHANGE while the dealer stays the same:
 *
 *   seed|<documentId>          the go-live CSV seed, 165 rows, never synced
 *   dz|<stem>|<suburb>         what ETN-014 derives while Connect sends no id
 *   <Connect's own reference>  what we go back to the moment they ship one
 *
 * Each of those transitions is a re-key of an existing dealer, and a plain
 * `cache.get` sees all of them as brand new. That is the doubling hazard
 * recorded against the go-live seed: 196 creates stacked on 165 existing rows,
 * every dealer listed twice, and no way back except by hand.
 *
 * So: match on the ref first, and only then on the derived key recomputed from
 * each cached row's OWN website and suburb. Measured against production on
 * 2026-09-01 the derived key reconciles 165 of the 165 seeded documents, which
 * turns the first sweep from 196 creates into 165 updates and 28 creates.
 *
 * Two rules keep it from ever being a guess:
 *
 *  - A derived key held by more than one cached document is dropped, not
 *    resolved. Ambiguity here would attach a dealer to a sibling's row and
 *    overwrite it.
 *  - Ref matches are ALL resolved before any derived match is considered, and a
 *    cached row can be claimed once. Otherwise a record could take a row that
 *    the record actually holding that ref was about to claim.
 *
 * Anything left unclaimed is genuinely absent from the feed, which is what
 * `missingRefs` and the bulk-disappearance brake are computed from, so this
 * runs before them, not after.
 *
 * TWO THINGS A CONTENT-DERIVED KEY CANNOT DO, both of which go away the moment
 * Connect ships a real `reference`:
 *
 *  - A dealer who MOVES suburb, or changes domain, derives a new key and is
 *    created as a second listing while the old row is flagged `missing` and
 *    stays published. Rare, visible, and fixed by deleting the flagged row.
 *  - If the derived key ever stopped matching WHOLESALE (Connect changing what
 *    `location.city` means, say), this reconciles nothing and the sweep creates
 *    the whole feed again. The brake below reports that, but it runs after the
 *    upsert loop, so it does not prevent it. Watch `rekeyed` in the summary:
 *    on the sweep that adopts a new key shape it should equal the cache size,
 *    and on every sweep after it should be 0.
 */
type CacheMatch = {
  cached: CachedDealer;
  /** The ref the row was stored under, when this sweep is about to change it. Reporting only. */
  rekeyedFrom: string | null;
};

function matchCache(
  records: ConnectDealerRecord[],
  cache: Map<string, CachedDealer>,
): { matches: Map<string, CacheMatch>; claimed: Set<string> } {
  const byDerived = new Map<string, CachedDealer | null>();
  for (const cached of cache.values()) {
    if (!cached.derivedKey) continue;
    // Second occurrence poisons the entry rather than overwriting it.
    byDerived.set(cached.derivedKey, byDerived.has(cached.derivedKey) ? null : cached);
  }

  const matches = new Map<string, CacheMatch>();
  const claimed = new Set<string>();

  for (const record of records) {
    const direct = cache.get(record.connectRef);
    if (!direct) continue;
    matches.set(record.connectRef, { cached: direct, rekeyedFrom: null });
    claimed.add(direct.connectRef);
  }

  for (const record of records) {
    if (matches.has(record.connectRef)) continue;
    const derived = derivedConnectRef(record.website, record.suburb);
    if (!derived) continue;
    const hit = byDerived.get(derived);
    if (!hit || claimed.has(hit.connectRef)) continue;
    matches.set(record.connectRef, { cached: hit, rekeyedFrom: hit.connectRef });
    claimed.add(hit.connectRef);
  }

  return { matches, claimed };
}

// ── change detection ─────────────────────────────────────────────────────────

/**
 * Fields excluded from the hash. `syncedAt` moves every sweep by definition;
 * `sourceStatus` / `missingSince` are the sync's own bookkeeping, compared
 * separately so a returning dealer is detected even when their content is
 * byte-identical to what we already hold.
 */
const VOLATILE_FIELDS = new Set(['syncedAt', 'sourceHash', 'sourceStatus', 'missingSince']);

/**
 * Content hash of everything the sweep would write.
 *
 * A hash rather than the baseplate's `sourceModified` delta cursor because
 * Connect exposes no per-record modified timestamp: its rows carry
 * `submitted_at`, `approved_at`, `rejected_at` and `processed_at`, none of which
 * moves when a dealer edits their own profile.
 *
 * Keys are sorted so the digest does not depend on object literal order, and the
 * resolved pin IS included — a pin that changes is a change worth writing.
 */
function contentHash(data: Record<string, unknown>): string {
  const stable = Object.keys(data)
    .filter((key) => !VOLATILE_FIELDS.has(key))
    .sort()
    .map((key) => [key, data[key]]);
  return createHash('sha1').update(JSON.stringify(stable)).digest('hex');
}

// ── settings read-out ────────────────────────────────────────────────────────

async function readSetting(strapi: Core.Strapi): Promise<Record<string, unknown> | null> {
  try {
    return (await strapi.documents(SETTING_UID as never).findFirst({} as never)) as Record<
      string,
      unknown
    > | null;
  } catch (error) {
    strapi.log.warn(`[dealer-sync] could not read integration settings: ${errorMessage(error)}`);
    return null;
  }
}

/**
 * Records the outcome on the Integration Setting single type so the admin panel
 * can answer "did it run, and did it work" without reading pm2 logs.
 *
 * A single type that has never been saved does not exist as a row, so this
 * creates it on first run rather than assuming an update target — the baseplate's
 * equivalent silently returns when `findFirst` is null, which on a fresh
 * database means the read-out is permanently blank.
 */
async function recordOutcome(
  strapi: Core.Strapi,
  existing: Record<string, unknown> | null,
  summary: DealerSyncSummary,
): Promise<void> {
  const data = {
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: summary.status === 'ok' ? 'ok' : 'failed',
    lastSyncSummary: JSON.stringify(summary, null, 2).slice(0, 4000),
  };

  try {
    if (existing?.documentId) {
      await strapi.documents(SETTING_UID as never).update({
        documentId: String(existing.documentId),
        data,
      } as never);
    } else {
      await strapi.documents(SETTING_UID as never).create({ data } as never);
    }
  } catch (error) {
    // Never let bookkeeping fail the sweep that already succeeded.
    strapi.log.warn(`[dealer-sync] could not record sync outcome: ${errorMessage(error)}`);
  }
}

// ── the sweep ────────────────────────────────────────────────────────────────

/**
 * One full sweep. Never throws: every failure path is reported in the returned
 * summary and in `lastSyncStatus`, because the callers are a cron task and an
 * admin-triggered endpoint, and neither has anywhere useful to put an exception.
 */
export async function runDealerSync(strapi: Core.Strapi): Promise<DealerSyncSummary> {
  const summary = createSummary();
  const setting = await readSetting(strapi);

  // Second guard, in front of the env master switch that gates cron
  // registration. Lets an admin stop the sweep on one environment without a
  // deploy. Nothing ran, so nothing is recorded.
  if (setting && setting.connectSyncEnabled === false) {
    summary.status = 'disabled';
    return summary;
  }

  let feed;
  try {
    feed = await fetchConnectDealerFeed();
  } catch (error) {
    // Rail 1: an incomplete read changes nothing. ConnectFeedError covers an
    // unreachable page, a non-JSON body and a feed longer than the page cap —
    // all of which are indistinguishable from mass deletion if acted on.
    summary.status = 'failed';
    summary.errors.push(
      error instanceof ConnectFeedError
        ? `feed unavailable: ${error.message}`
        : `feed failed: ${errorMessage(error)}`,
    );
    strapi.log.error(`[dealer-sync] ${summary.errors[0]} — nothing written`);
    await recordOutcome(strapi, setting, summary);
    return summary;
  }

  summary.fetched = feed.records.length;
  summary.requests = feed.requests;

  const mapped = feed.records
    .map(toDealerRecord)
    .filter((record): record is ConnectDealerRecord => record !== null);
  summary.mapped = mapped.length;

  // Rails 2 and 3, together: no records at all, or records that all failed to
  // map. Both are no-ops, and both are FAILURES rather than "the directory is
  // empty now" — that conflation is what let an upstream wipe render as a calm
  // "0 caravan dealers" on 2026-08-20, and a shape change render as "no dealers
  // listed yet" on 2026-08-17.
  if (mapped.length === 0) {
    summary.status = 'failed';
    summary.errors.push(
      feed.records.length === 0
        ? `Connect returned no dealer records (meta.total ${feed.total ?? 'absent'})`
        : `read ${feed.records.length} records and mapped none — the response shape has changed`,
    );
    strapi.log.error(`[dealer-sync] ${summary.errors[0]} — nothing written`);
    await recordOutcome(strapi, setting, summary);
    return summary;
  }

  // Connect has shipped the same dealership twice before (Vision RV and
  // Goldstream RV were both duplicated on the live feed). Last record wins;
  // without this the second one would overwrite the first mid-sweep and both
  // would report as updated every time.
  const byRef = new Map<string, ConnectDealerRecord>();
  for (const record of mapped) byRef.set(record.connectRef, record);
  summary.duplicates = mapped.length - byRef.size;

  const cache = await loadCache(strapi);
  const submissionIndex = await loadSubmissionIndex(strapi);
  const sharedStems = sharedConnectStems([...byRef.values()]);

  // Which cached row each record belongs to, resolved in one pass up front:
  // a record can be holding a ref that has changed since the row was written,
  // and the missing set below is the rows NOTHING claimed, not the refs absent
  // from the feed.
  const { matches, claimed } = matchCache([...byRef.values()], cache);

  // Rail 4, computed BEFORE any write so the decision is made on a complete
  // picture rather than on however far the upsert loop happened to get.
  const missingRefs = [...cache.keys()].filter((ref) => !claimed.has(ref));
  const brakeTripped =
    cache.size > 0 && missingRefs.length / cache.size > MISSING_BRAKE_RATIO;

  const syncedAt = new Date().toISOString();

  // Every write below is a `dealer` row change, and the content-type lifecycle
  // pings the frontend's revalidate route on those. Suppressed here so a first
  // sweep of 180 dealers does not fire 180 HTTP calls to invalidate one tag; the
  // instant-revalidate path exists for the human publish toggle only.
  await withoutRevalidate(async () => {
    for (const record of byRef.values()) {
      const match = matches.get(record.connectRef);
      const cached = match?.cached;

      const pin = resolvePin(
        cached?.pin ?? NO_PIN,
        matchSubmissionPin(record, submissionIndex, sharedStems),
        connectPin(record),
      );

      if (pin.precision === 'street') summary.pins.street += 1;
      else if (pin.latitude !== null) summary.pins.approx += 1;
      else {
        summary.pins.none += 1;
        if (summary.unpinned.length < MAX_REPORTED_UNPINNED) {
          summary.unpinned.push(record.dealershipName);
        }
      }

      // connectLatitude/connectLongitude are NOT columns — they are candidates
      // consumed by resolvePin above. Strapi's validateInput throws on any root
      // key with no matching attribute, so they have to come off here.
      const { connectLatitude: _lat, connectLongitude: _lng, ...fields } = record;

      const data: Record<string, unknown> = {
        ...fields,
        ...pin,
        sourceStatus: 'live',
        missingSince: null,
        syncedAt,
      };
      data.sourceHash = contentHash(data);

      // THE SKIP. No write, no publish, no `updatedAt` churn — and crucially no
      // publish(), which is where the baseplate's inventory-sync silently undoes
      // a manual unpublish. `sourceStatus` is compared separately so a dealer
      // returning from `missing` still gets the one write that clears the flag.
      if (
        cached &&
        cached.sourceHash === data.sourceHash &&
        cached.sourceStatus === 'live'
      ) {
        summary.skipped += 1;
        continue;
      }

      try {
        if (cached) {
          // Updates the DRAFT. Strapi's document service leaves the published
          // version alone unless asked, which is exactly what we want: a hidden
          // dealer's draft keeps receiving fresh data (so publishing them later
          // publishes current values, not a snapshot from when they were hidden)
          // while they stay absent from the page.
          await strapi.documents(DEALER_UID as never).update({
            documentId: cached.documentId,
            data,
          } as never);

          // ...and publish ONLY if a published version already exists. This one
          // condition is the publication gate.
          if (cached.hasPublished) {
            await strapi.documents(DEALER_UID as never).publish({
              documentId: cached.documentId,
            } as never);
          }

          summary.updated += 1;
          // `data.connectRef` is the ref THIS sweep carried, so the update above is
          // what actually re-keys the row; this only records that it happened.
          if (match?.rekeyedFrom) summary.rekeyed += 1;
          if (cached.sourceStatus === 'missing') summary.returned += 1;
        } else {
          // New dealers arrive PUBLISHED (ETN-013 D1): the directory stays
          // complete with nobody tending it. Accepted consequence — a Connect
          // test or lorem row goes live until someone hides it, and hiding it is
          // then permanent, because the sweep never republishes.
          await strapi.documents(DEALER_UID as never).create({
            data,
            status: 'published',
          } as never);
          summary.created += 1;
        }
      } catch (error) {
        summary.errors.push(`${record.connectRef}: ${errorMessage(error)}`);
      }
    }

    if (brakeTripped) {
      // Rail 4. Marks NOTHING. A fifth of the directory vanishing at once is far
      // more likely to be an upstream import mid-flight than a fifth of the
      // dealers leaving the programme, and the flag is the thing a human acts on.
      summary.status = 'failed';
      summary.errors.push(
        `bulk-disappearance brake: ${missingRefs.length} of ${cache.size} cached dealers absent ` +
          `(over ${Math.round(MISSING_BRAKE_RATIO * 100)}%) — none marked missing`,
      );
      strapi.log.error(`[dealer-sync] ${summary.errors[summary.errors.length - 1]}`);
      return;
    }

    for (const ref of missingRefs) {
      const cached = cache.get(ref)!;
      // Already flagged: leave it alone. `missingSince` records when it FIRST
      // went missing, and re-stamping it every 10 minutes would erase exactly
      // the information it exists to carry.
      if (cached.sourceStatus === 'missing') continue;

      try {
        await strapi.documents(DEALER_UID as never).update({
          documentId: cached.documentId,
          data: { sourceStatus: 'missing', missingSince: syncedAt },
        } as never);

        // Same publish rule as above. Keeps draft and published in step so the
        // admin does not show a permanent phantom "Modified" badge, without ever
        // republishing a dealer staff deliberately hid.
        if (cached.hasPublished) {
          await strapi.documents(DEALER_UID as never).publish({
            documentId: cached.documentId,
          } as never);
        }

        summary.markedMissing += 1;
      } catch (error) {
        summary.errors.push(`${ref} mark-missing: ${errorMessage(error)}`);
      }
    }
  });

  if (summary.errors.length > 0 && summary.status === 'ok') {
    // Per-dealer write failures do not invalidate the sweep, but they must not
    // report as a clean run either.
    summary.status = 'failed';
  }

  await recordOutcome(strapi, setting, summary);
  return summary;
}
