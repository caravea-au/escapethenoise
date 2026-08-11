// One-off migration: loads the 142 coordinates that used to live in the
// committed frontend/src/lib/dealer-geocodes.json sidecar into the
// `dealer-geocode` Strapi collection, so coordinates stop needing a code deploy
// to change.
//
// The data now sits next to this script as dealer-geocodes.seed.json rather than
// in the frontend, for two reasons: the frontend must no longer bundle it, and
// this migration has to be runnable on the live box AFTER the deploy that
// removed it. It is migration input, not runtime data — nothing reads it at
// request time. Once every environment has been imported, both can go.
//
//   STRAPI_TOKEN=... npm run seed:dealer-geo-import          (from backend/)
//   STRAPI_TOKEN=... npm run seed:dealer-geo-import -- --dry
//
// Idempotent: upserts on dealerDocumentId, so re-running is safe and only fills
// what is missing. Existing rows are left ALONE unless --overwrite is passed —
// a staff member may have corrected a pin by hand since the last run, and
// silently clobbering that is exactly the failure this migration exists to end.
//
// Run this against LIVE after deploying, before the Phase B frontend goes out:
// until these rows exist, every dealer falls back to their postcode centroid.
// Back up data.db first.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDECAR = resolve(HERE, "dealer-geocodes.seed.json");

// 127.0.0.1, not localhost: Node's fetch resolves localhost to ::1 first and
// Strapi binds IPv4 only, which fails with an opaque ECONNREFUSED.
const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337";
const TOKEN = process.env.STRAPI_TOKEN ?? "";

const DRY = process.argv.includes("--dry");
const OVERWRITE = process.argv.includes("--overwrite");

if (!TOKEN) {
  console.error("STRAPI_TOKEN is required (a full-access API token).");
  process.exit(1);
}
if (!existsSync(SIDECAR)) {
  console.error(`Not found: ${SIDECAR}\nIf it has been removed, this migration is already done everywhere.`);
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

/** @type {Record<string, [number, number, string, string]>} */
const sidecar = JSON.parse(readFileSync(SIDECAR, "utf8"));
const entries = Object.entries(sidecar);
console.log(`${entries.length} geocodes in ${SIDECAR}`);

// Page through what is already there, so a re-run doesn't re-POST everything.
// pageSize 100 is config/api.ts's maxLimit.
const existing = new Map();
for (let page = 1; ; page += 1) {
  const res = await fetch(
    `${STRAPI_URL}/api/dealer-geocodes?fields[0]=dealerDocumentId&fields[1]=source&pagination[page]=${page}&pagination[pageSize]=100`,
    { headers },
  );
  if (!res.ok) {
    console.error(`GET /api/dealer-geocodes failed: ${res.status} ${await res.text()}`);
    console.error("A full-access token is required — a read-only one cannot see this collection.");
    process.exit(1);
  }
  const json = await res.json();
  for (const row of json.data ?? []) {
    existing.set(row.dealerDocumentId, { documentId: row.documentId, source: row.source });
  }
  const { page: cur, pageCount } = json.meta?.pagination ?? {};
  if (!pageCount || cur >= pageCount) break;
}
console.log(`${existing.size} already in Strapi`);

let created = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

for (const [dealerDocumentId, tuple] of entries) {
  const [latitude, longitude, precision, matchedAddress] = tuple;
  const payload = {
    dealerDocumentId,
    latitude,
    longitude,
    // The sidecar's third element is exactly this collection's `precision` enum.
    precision: precision === "street" ? "street" : "approx",
    source: "imported",
    matchedAddress: String(matchedAddress ?? "").slice(0, 300),
    // The sidecar never recorded which address string produced the match, so
    // there is nothing honest to put here. Left blank rather than guessed at:
    // a wrong value would make a later staleness check silently useless.
    geocodedAddress: "",
  };

  const hit = existing.get(dealerDocumentId);
  if (hit && !OVERWRITE) {
    skipped += 1;
    continue;
  }

  if (DRY) {
    console.log(`${hit ? "would update" : "would create"} ${dealerDocumentId} ${latitude},${longitude} ${payload.precision}`);
    hit ? (updated += 1) : (created += 1);
    continue;
  }

  const url = hit
    ? `${STRAPI_URL}/api/dealer-geocodes/${hit.documentId}`
    : `${STRAPI_URL}/api/dealer-geocodes`;
  const res = await fetch(url, {
    method: hit ? "PUT" : "POST",
    headers,
    body: JSON.stringify({ data: payload }),
  });

  if (res.ok) {
    hit ? (updated += 1) : (created += 1);
  } else {
    failed += 1;
    console.warn(`  ! ${dealerDocumentId}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
}

console.log(
  `\n${created} created · ${updated} updated · ${skipped} left alone` +
    `${failed ? ` · ${failed} FAILED` : ""}${DRY ? "  (dry run, nothing written)" : ""}`,
);
if (skipped && !OVERWRITE) {
  console.log("Existing rows were left as-is. Pass --overwrite to replace them.");
}
