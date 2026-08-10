// Geocodes each dealer's FULL street address to per-dealer coordinates, so two
// dealers sharing a postcode no longer stack on the same postcode centroid.
//
//   npm run seed:dealer-geo            (from backend/, with Strapi running)
//   npm run seed:dealer-geo -- --force (re-query rows that already resolved)
//
// Output: frontend/src/lib/dealer-geocodes.json, keyed by dealer documentId.
// This is a SIDECAR file, deliberately not a schema change: `dealer-submission`
// is a temporary stand-in for a real dealer API and the client forbade adding
// fields to it. `au-postcode-centroids.json` stays as the fallback.
//
// Nominatim policy — non-negotiable, breaking these gets the IP blocked:
//   * 1 request per second, hard. Calls are spaced 1100 ms and strictly serial.
//     Never Promise.all this.
//   * A real identifying User-Agent is mandatory.
//   * Results are ODbL: storable WITH attribution. The map UI must keep
//     rendering "© OpenStreetMap contributors".
// Do NOT geocode with Mapbox: its standard Geocoding API forbids storing
// results (only the paid Permanent endpoint allows it). The Mapbox token in
// this project is for tiles only.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(HERE, "../../frontend/src/lib/dealer-geocodes.json");

// 127.0.0.1, not localhost: Node's fetch resolves localhost to ::1 first and
// Strapi binds IPv4 only, which fails with an opaque ECONNREFUSED.
const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "nobettertime-dealer-directory/1.0 (christian.hayag@caravea.au)";

const FORCE = process.argv.includes("--force");
const RATE_MS = 1100;
// place_rank 30 = house/building, 26-27 = road. Anything coarser (suburb,
// town) is only as good as a centroid, so it is labelled approximate and
// distance labels keep their "~".
const STREET_RANK = 26;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Street-type and unit words carry no location information on their own —
// "Road" matching "Road" proves nothing about whether we found the right road.
const GENERIC_STREET_WORDS = new Set([
  "st", "street", "rd", "road", "ave", "avenue", "dr", "drive", "hwy", "highway",
  "ct", "court", "pl", "place", "cres", "crescent", "cl", "close", "way", "pde",
  "parade", "blvd", "boulevard", "tce", "terrace", "lane", "ln", "esp",
  "esplanade", "cct", "circuit", "grove", "square", "sq", "unit", "shop", "lot",
  "suite", "factory", "north", "south", "east", "west", "the", "and", "australia",
]);

/**
 * Normalises a free-text street field into something Nominatim's structured
 * `street` param can actually match. Real data here includes "Unit 1, 9 Maxwell
 * Place", "4/11 Kelly Court" and "12 Airport Dr, Kensington QLD 4670, Australia".
 * Strips a leading unit/shop designator, takes the sub-address after a slash,
 * and drops everything after the first comma (which is where dealers repeat the
 * suburb/state/postcode and derail the query).
 */
function cleanStreet(street) {
  let s = String(street ?? "").trim();
  s = s.replace(/^\s*(?:unit|u|shop|suite|ste|factory|lot|building|bldg)\s*\.?\s*[\w-]+\s*[,/]\s*/i, "");
  s = s.split(",")[0];
  s = s.replace(/^\s*[\w-]+\s*\/\s*/, ""); // "4/11 Kelly Court" -> "11 Kelly Court"
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Did we land on the road we actually asked for? Nominatim silently falls back
 * to *a* road in the right suburb when it can't find the one requested — e.g.
 * "9 Maxwell Place, Narellan" came back as "Queen Street, Narellan", which is
 * road-level but the wrong road. Requires at least one distinctive word from
 * the dealer's street to appear in the matched name before we call it precise.
 */
function matchedTheRightStreet(street, displayName) {
  const target = displayName.toLowerCase();
  const words = (cleanStreet(street).toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(
    (w) => !GENERIC_STREET_WORDS.has(w),
  );
  if (!words.length) return false;
  return words.some((w) => target.includes(w));
}

/** One Nominatim call with a small retry/backoff. Returns the first result or null. */
async function query(url, label) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-AU" },
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(RATE_MS * (attempt + 2));
        continue;
      }
      if (!res.ok) return null;
      const json = await res.json();
      return Array.isArray(json) && json.length ? json[0] : null;
    } catch (err) {
      if (attempt === 2) console.warn(`  ! ${label}: ${err.message}`);
      await sleep(RATE_MS * (attempt + 2));
    }
  }
  return null;
}

/**
 * Three-tier ladder: structured street query, then freeform, then suburb +
 * postcode. Note `state` is deliberately absent from the structured query —
 * Nominatim wants full state names and returns [] for "VIC", and AU postcodes
 * are nationally unique so it adds nothing.
 */
async function geocode(dealer) {
  const { street, suburb, state, postcode } = dealer;
  const enc = encodeURIComponent;
  const base = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=au";

  const cleaned = cleanStreet(street);
  const tiers = [];
  if (cleaned && suburb) {
    tiers.push({
      tier: "street",
      url: `${base}&street=${enc(cleaned)}&city=${enc(suburb)}${postcode ? `&postalcode=${enc(postcode)}` : ""}`,
    });
  }
  if (cleaned) {
    tiers.push({
      tier: "freeform",
      url: `${base}&q=${enc([cleaned, [suburb, state, postcode].filter(Boolean).join(" "), "Australia"].filter(Boolean).join(", "))}`,
    });
  }
  if (suburb || postcode) {
    tiers.push({
      tier: "suburb",
      url: `${base}&q=${enc(`${[suburb, state, postcode].filter(Boolean).join(" ")}, Australia`)}`,
    });
  }

  for (const { tier, url } of tiers) {
    const hit = await query(url, dealer.dealershipName);
    await sleep(RATE_MS);
    if (!hit) continue;
    return {
      tier,
      lat: Number(Number(hit.lat).toFixed(6)),
      lng: Number(Number(hit.lon).toFixed(6)),
      // Three conditions, all required, because each catches a different way a
      // result can look better than it is: the tier must have actually carried
      // the street; the result must be road-level or finer; and it must be the
      // road we asked for, not Nominatim's same-suburb fallback.
      precision:
        tier !== "suburb" &&
        Number(hit.place_rank) >= STREET_RANK &&
        matchedTheRightStreet(street, hit.display_name ?? "")
          ? "street"
          : "approx",
      match: hit.display_name ?? "",
    };
  }
  return null;
}

// ── run ──────────────────────────────────────────────────────────────────────

const res = await fetch(`${STRAPI_URL}/api/dealers`);
if (!res.ok) {
  console.error(`GET ${STRAPI_URL}/api/dealers failed: ${res.status}. Is Strapi running?`);
  process.exit(1);
}
const dealers = (await res.json()).data;
console.log(`${dealers.length} dealers from ${STRAPI_URL}`);

/** @type {Record<string, [number, number, string, string]>} */
const existing = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf8")) : {};
// --force means "re-derive everything", so it starts from empty rather than
// merging. Keeping old rows would silently preserve entries written under an
// earlier version of the precision rules, which is the exact thing a forced
// re-run is meant to correct. A row that now fails to resolve correctly falls
// back to its postcode centroid instead of keeping a stale coordinate.
const output = FORCE ? {} : { ...existing };

const todo = dealers.filter((d) => FORCE || !output[d.documentId]);
console.log(
  `${Object.keys(existing).length} already resolved · ${todo.length} to query` +
    (todo.length ? ` (~${Math.ceil((todo.length * RATE_MS * 1.6) / 60000)} min)` : ""),
);

const misses = [];
let done = 0;
for (const dealer of todo) {
  const hit = await geocode(dealer);
  done += 1;
  if (hit) {
    output[dealer.documentId] = [hit.lat, hit.lng, hit.precision, hit.match];
  } else {
    misses.push(dealer);
  }
  console.log(
    `${String(done).padStart(3)}/${todo.length} ` +
      `${(dealer.dealershipName ?? "").slice(0, 28).padEnd(28)} ` +
      `${hit ? `${hit.tier}/${hit.precision}`.padEnd(16) : "MISS".padEnd(16)}` +
      `${hit ? `${hit.lat},${hit.lng}` : `${dealer.suburb ?? ""} ${dealer.postcode ?? ""}`}`,
  );
}

// One line per dealer with sorted keys, so re-running produces a stable diff
// that stays reviewable in a PR.
const keys = Object.keys(output).sort();
const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(output[k])}`).join(",\n");
writeFileSync(OUT_FILE, `{\n${body}\n}\n`);

const street = keys.filter((k) => output[k][2] === "street").length;
console.log(
  `\n${keys.length}/${dealers.length} geocoded ` +
    `(${street} street-level, ${keys.length - street} approximate) -> ${OUT_FILE}`,
);
if (misses.length) {
  console.log(`\n${misses.length} unresolved (these fall back to the postcode centroid):`);
  misses.forEach((d) => console.log(`  ${d.dealershipName} — ${d.street ?? ""}, ${d.suburb ?? ""} ${d.postcode ?? ""}`));
}
