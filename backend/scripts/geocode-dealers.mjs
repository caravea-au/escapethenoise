// Fills coordinate GAPS: finds dealers with no `dealer-geocode` row and geocodes
// their street address, so two dealers sharing a postcode no longer stack on the
// same postcode centroid.
//
//   STRAPI_TOKEN=... npm run seed:dealer-geo          (from backend/, Strapi running)
//   STRAPI_TOKEN=... npm run seed:dealer-geo -- --dry
//
// This used to own the geocoding heuristics and write them to a committed
// frontend/src/lib/dealer-geocodes.json sidecar. Both are gone:
//
//   * The heuristics now live in src/utils/geocode-address.ts and are reached
//     through POST /api/dealer-geocodes/resolve, so there is exactly ONE
//     implementation shared by this script and the onboarding form. Do not
//     reintroduce a copy here.
//   * Coordinates live in the `dealer-geocode` collection, so a wrong pin is an
//     admin edit rather than a code deploy, and a newly onboarded dealer gets a
//     pin the moment they submit instead of waiting for someone to run this.
//
// That makes this script a backstop, not the main path: most dealers now place
// their own pin on the onboarding form. Use it for dealers who predate that, or
// whose submission produced no pin.
//
// Rows this script has never touched are left alone (a dealer-placed or
// staff-corrected pin must never be overwritten by a guess) unless --overwrite.
//
// Nominatim policy is enforced server-side by utils/geocode-address.ts: 1 req/sec
// process-wide, real User-Agent, ODbL attribution required wherever the
// coordinates are displayed. Do NOT geocode with Mapbox — its standard Geocoding
// API forbids storing results.

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

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ── who needs a pin ──────────────────────────────────────────────────────────

const dealersRes = await fetch(`${STRAPI_URL}/api/dealers`);
if (!dealersRes.ok) {
  console.error(`GET ${STRAPI_URL}/api/dealers failed: ${dealersRes.status}. Is Strapi running?`);
  process.exit(1);
}
const dealers = (await dealersRes.json()).data;

const existing = new Map();
for (let page = 1; ; page += 1) {
  const res = await fetch(
    `${STRAPI_URL}/api/dealer-geocodes?fields[0]=dealerDocumentId&fields[1]=source&pagination[page]=${page}&pagination[pageSize]=100`,
    { headers },
  );
  if (!res.ok) {
    console.error(`GET /api/dealer-geocodes failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  for (const row of json.data ?? []) {
    existing.set(row.dealerDocumentId, { documentId: row.documentId, source: row.source });
  }
  const { page: cur, pageCount } = json.meta?.pagination ?? {};
  if (!pageCount || cur >= pageCount) break;
}

const todo = dealers.filter((d) => OVERWRITE || !existing.has(d.documentId));
console.log(
  `${dealers.length} dealers · ${existing.size} already have a pin · ${todo.length} to geocode` +
    (todo.length ? ` (~${Math.ceil((todo.length * 1.1 * 1.6) / 60)} min, 1 req/sec upstream)` : ""),
);

// ── geocode + store ─────────────────────────────────────────────────────────

let stored = 0;
let missed = 0;
let failed = 0;
const misses = [];

for (const dealer of todo) {
  const lookup = await fetch(`${STRAPI_URL}/api/dealer-geocodes/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        street: dealer.street,
        suburb: dealer.suburb,
        state: dealer.state,
        postcode: dealer.postcode,
      },
    }),
  });

  const name = (dealer.dealershipName ?? "").slice(0, 28).padEnd(28);

  if (!lookup.ok) {
    failed += 1;
    console.log(`${name} LOOKUP ${lookup.status}`);
    continue;
  }

  const hit = (await lookup.json()).data;
  if (!hit) {
    missed += 1;
    misses.push(dealer);
    console.log(`${name} MISS             ${dealer.suburb ?? ""} ${dealer.postcode ?? ""}`);
    continue;
  }

  if (DRY) {
    stored += 1;
    console.log(`${name} would store      ${hit.lat},${hit.lng} ${hit.precision}`);
    continue;
  }

  const prior = existing.get(dealer.documentId);
  const payload = {
    dealerDocumentId: dealer.documentId,
    latitude: hit.lat,
    longitude: hit.lng,
    precision: hit.precision,
    source: "geocoded",
    matchedAddress: String(hit.matchedAddress ?? "").slice(0, 300),
    geocodedAddress: String(hit.geocodedAddress ?? "").slice(0, 300),
  };

  const write = await fetch(
    prior
      ? `${STRAPI_URL}/api/dealer-geocodes/${prior.documentId}`
      : `${STRAPI_URL}/api/dealer-geocodes`,
    { method: prior ? "PUT" : "POST", headers, body: JSON.stringify({ data: payload }) },
  );

  if (write.ok) {
    stored += 1;
    console.log(`${name} ${String(hit.precision).padEnd(16)} ${hit.lat},${hit.lng}`);
  } else {
    failed += 1;
    console.log(`${name} WRITE ${write.status} ${(await write.text()).slice(0, 120)}`);
  }
}

console.log(
  `\n${stored} stored · ${missed} unresolved · ${failed} failed` +
    (DRY ? "  (dry run, nothing written)" : ""),
);
if (misses.length) {
  console.log(`\n${misses.length} unresolved (these fall back to the postcode centroid):`);
  misses.forEach((d) =>
    console.log(`  ${d.dealershipName} — ${d.street ?? ""}, ${d.suburb ?? ""} ${d.postcode ?? ""}`),
  );
}
