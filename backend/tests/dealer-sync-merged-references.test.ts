// CCV-159 AC7: a Connect merge survivor lists the refs it absorbed in
// `merged_references`; the sync re-keys the cached row held under one of them
// onto the survivor, so the dealer stays ONE card.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  matchCache,
  runDealerSync,
  type CachedDealer,
} from '../src/api/integration/services/dealer-sync';
import { toDealerRecord } from '../src/utils/connect-dealer-feed';

const A = 'caraveacomp|A';
const B = 'caraveacomp|B';
const C = 'caraveacomp|C';
const D = 'caraveacomp|D';

function cachedRow(connectRef: string, over: Partial<CachedDealer> = {}): CachedDealer {
  return {
    documentId: `doc-${connectRef}`,
    connectRef,
    derivedKey: null,
    hasPublished: true,
    sourceHash: null,
    sourceStatus: 'live',
    connectStatus: 'approved',
    autoHiddenAt: null,
    pin: {} as CachedDealer['pin'],
    ...over,
  };
}

function cacheOf(...rows: CachedDealer[]): Map<string, CachedDealer> {
  return new Map(rows.map((row) => [row.connectRef, row]));
}

/** The survivor's record as the feed maps it: ref B, absorbing `merged`. */
function survivor(merged: string[]) {
  const record = toDealerRecord({
    reference: B,
    status: 'approved',
    company: { name: 'Vision RV' },
    merged_references: merged,
  });
  assert.ok(record, 'survivor record maps');
  return record;
}

test('re-keys the cached row held under an absorbed ref onto the survivor and claims it', () => {
  const { matches, claimed } = matchCache([survivor([A])], cacheOf(cachedRow(A)));

  assert.equal(matches.get(B)?.cached.documentId, `doc-${A}`);
  assert.equal(matches.get(B)?.rekeyedFrom, A);
  assert.ok(claimed.has(A), 'claimed rows are never flagged missing or auto-hidden');
});

test('no merged refs and no cache hit leaves the record unmatched, so a new dealer still creates', () => {
  const { matches, claimed } = matchCache([survivor([])], cacheOf(cachedRow(A)));

  assert.equal(matches.size, 0);
  assert.equal(claimed.size, 0);
});

test('a survivor already cached directly keeps its own card and the absorbed row stays unclaimed', () => {
  const { matches, claimed } = matchCache([survivor([A])], cacheOf(cachedRow(A), cachedRow(B)));

  assert.equal(matches.get(B)?.cached.connectRef, B);
  assert.equal(matches.get(B)?.rekeyedFrom, null);
  assert.ok(!claimed.has(A), 'left unclaimed so the absence rule hides it');
});

test('several cached rows: published beats auto-hidden beats staff-hidden, ties by merged_references order', () => {
  const published = cachedRow(A);
  const publishedLater = cachedRow(D);
  const autoHidden = cachedRow(B + '-auto', {
    hasPublished: false,
    autoHiddenAt: '2026-10-01T00:00:00.000Z',
  });
  const staffHidden = cachedRow(C, { hasPublished: false });

  const pick = (merged: string[], ...rows: CachedDealer[]) =>
    matchCache([survivor(merged)], cacheOf(...rows)).matches.get(B)?.cached.connectRef;

  assert.equal(pick([C, autoHidden.connectRef, A], published, autoHidden, staffHidden), A);
  assert.equal(pick([C, autoHidden.connectRef], autoHidden, staffHidden), autoHidden.connectRef);
  assert.equal(pick([C], staffHidden), C);
  assert.equal(pick([D, A], published, publishedLater), D, 'tie goes to the first listed');
});

test('toDealerRecord reads merged_references into mergedReferences and defaults to []', () => {
  assert.deepEqual(survivor([A, C]).mergedReferences, [A, C]);
  assert.deepEqual(toDealerRecord({ reference: B, company: { name: 'X' } })?.mergedReferences, []);
});

test('a sweep rewrites the survivor ref on the same documentId and never writes mergedReferences', async () => {
  const calls: { op: string; uid: string; arg: Record<string, any> }[] = [];
  const documents = (uid: string) =>
    Object.fromEntries(
      ['findFirst', 'update', 'create', 'publish', 'unpublish'].map((op) => [
        op,
        async (arg: Record<string, any>) => {
          calls.push({ op, uid, arg });
          return null;
        },
      ]),
    );
  // One published dealer (draft + published row) keyed on the absorbed ref A,
  // carrying a pin a staff member placed by hand (the draft row is the one read).
  const adminPin = { latitude: -33.8688, longitude: 151.2093, precision: 'street', geocodeSource: 'admin' };
  const dealerRows = [A, A].map((connectRef, index) => ({
    documentId: 'doc-A',
    connectRef,
    publishedAt: index === 0 ? '2026-10-01T00:00:00.000Z' : null,
    sourceHash: 'old',
    website: null,
    suburb: null,
    ...adminPin,
  }));
  const strapi = {
    db: {
      query: (uid: string) => ({
        findMany: async () => (uid.includes('dealer-submission') ? [] : dealerRows),
      }),
    },
    documents,
    log: { info() {}, warn() {}, error() {} },
  } as any;

  const realFetch = globalThis.fetch;
  const realEnv = { url: process.env.CONNECT_API_URL, key: process.env.CONNECT_API_KEY };
  process.env.CONNECT_API_URL = 'https://connect.test';
  process.env.CONNECT_API_KEY = 'test-key';
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      data: [{ reference: B, status: 'approved', company: { name: 'Vision RV' }, merged_references: [A] }],
      meta: { last_page: 1, total: 1 },
    }),
  })) as any;

  try {
    const summary = await runDealerSync(strapi);
    assert.deepEqual(summary.errors, []);
    assert.equal(summary.rekeyed, 1);
    assert.equal(summary.created, 0);
    assert.equal(summary.markedMissing, 0);
    assert.equal(summary.autoHidden, 0);

    const dealerCalls = calls.filter((call) => call.uid === 'api::dealer.dealer');
    const update = dealerCalls.find((call) => call.op === 'update');
    assert.equal(update?.arg.documentId, 'doc-A');
    assert.equal(update?.arg.data.connectRef, B);
    for (const [key, value] of Object.entries(adminPin)) {
      assert.equal(update?.arg.data[key], value, `manual pin ${key} kept through the re-key`);
    }
    assert.ok(update && !('mergedReferences' in update.arg.data), 'mergedReferences is not a column');
    assert.ok(!dealerCalls.some((call) => call.op === 'create'));
    assert.equal(dealerCalls.filter((call) => call.op === 'publish').length, 1, 'published state kept');
  } finally {
    globalThis.fetch = realFetch;
    if (realEnv.url === undefined) delete process.env.CONNECT_API_URL;
    else process.env.CONNECT_API_URL = realEnv.url;
    if (realEnv.key === undefined) delete process.env.CONNECT_API_KEY;
    else process.env.CONNECT_API_KEY = realEnv.key;
  }
});
