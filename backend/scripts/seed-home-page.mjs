// Seed the `home-page` single type's hero (partial merge), trustBar and
// lifestyle components with the same fallback copy the React components use
// (Hero.tsx / TrustBar.tsx / LifestyleBand.tsx), so seeding is a visual no-op —
// the client just gains the ability to edit this copy in Strapi without a
// code deploy.
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:home-page                              # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:home-page   # live
//
// Flags:
//   --dry-run   print the assembled payload as JSON and write nothing
//   --yes       proceed even if the draft and published home-page differ
//               (otherwise the script refuses, since PUT ?status=published
//               would publish those pending edits as a side effect)
//
// home-page has draftAndPublish: true (backend/src/api/home-page/content-types/
// home-page/schema.json), unlike header/footer/vehicle-listings-page. A plain
// PUT only writes the draft — the public (tokenless) API keeps serving the old
// published version — so the write here MUST be PUT ?status=published.
//
// `hero` already holds real live copy (title/subtitle) that this script must
// never touch. Strapi replaces a non-repeatable component wholesale on update,
// so the script GETs the current hero first, strips document metadata (keeping
// the component's numeric `id` so the row is updated in place, not orphaned),
// merges only the fields below over it, and hard-asserts title/subtitle are
// unchanged before writing — it throws rather than silently overwriting.
//
// `openDay` is DELIBERATELY NOT SEEDED and must stay that way: its date
// (12 July 2026) is stale, and leaving the field null is what keeps the Open
// Day section hidden. Do not "helpfully" add an openDay key here. `journey`,
// `buyingGuidesHeader` and `seo` are also omitted — Strapi only touches
// attributes present in `data`, so omitting them leaves whatever is already
// live untouched.
//
// No media is uploaded: ciaaLogo/stateLogos/backgroundImage stay whatever they
// already are (null on live today) and the frontend falls back to its bundled
// /brand and /photos assets.
//
// Idempotent: running it twice is a no-op.

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");
const YES = process.argv.includes("--yes");

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// Same deep-populate the frontend uses — frontend/src/lib/strapi.ts, HOME_POPULATE.
const HOME_POPULATE = [
  "populate[hero][populate]=*",
  "populate[trustBar][populate][stats]=true",
  "populate[trustBar][populate][stateLogos][populate]=*",
  "populate[trustBar][populate][ciaaLogo]=true",
  "populate[journey][populate][cards]=true",
  "populate[buyingGuidesHeader]=true",
  "populate[lifestyle][populate]=*",
  "populate[openDay]=true",
  "populate[seo][populate]=*",
].join("&");

// Partial — merged over the existing hero. NEVER add title/subtitle here.
const HERO_FIELDS = {
  eyebrow: "No better time to",
  searchPlaceholder: "Enter suburb or postcode…",
  searchCtaLabel: "Find Dealers",
  locationChipLabel: "Use my location",
  stateChipLabel: "Browse by state",
};

const TRUST_BAR = {
  eyebrow: "Trusted across Australia",
  heading: "The national standard in\naccredited caravan dealers",
  stats: [
    { value: "403", showPlus: true, label: "Accredited Dealers" },
    { value: "8", showPlus: false, label: "States & Territories" },
    { value: "60", showPlus: true, label: "Brands Represented" },
  ],
  partnersEyebrow: "Backed by the industry",
  partnersHeading:
    "In partnership with Australia's state & territory caravanning associations",
  ciaaLabel: "The official directory of",
  // ciaaLogo / stateLogos intentionally omitted — no media upload; TrustBar.tsx
  // falls back to the bundled /brand assets when they're empty.
};

const LIFESTYLE = {
  eyebrow: "No better time to escape the noise",
  heading: "The open road is calling",
  body:
    "From coastal parks to outback skies, every great trip starts with the right van — and the right accredited dealer to set you up. Find yours and go.",
  ctaLabel: "Find your nearest dealer →",
  ctaUrl: "/find-dealer",
  // backgroundImage intentionally omitted — no media upload.
};

const META_KEYS = ["documentId", "createdAt", "updatedAt", "publishedAt", "locale"];

/** A populated Strapi v5 media object looks like { id, url, mime, ... }. */
function isMediaObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && "url" in v && "mime" in v;
}

/** Strip document metadata from a fetched component, keep the numeric `id`
 *  (so Strapi updates that component row in place instead of orphaning it),
 *  and reduce any populated media object down to its id. */
function clean(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(clean);
  if (isMediaObject(value)) return value.id ?? null;
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (META_KEYS.includes(k)) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

/** Same as clean() but also drops `id` — used only to compare draft vs
 *  published content, whose row ids legitimately differ between versions. */
function contentOnly(value) {
  const c = clean(value);
  if (Array.isArray(c)) return c.map(contentOnly);
  if (c && typeof c === "object") {
    const out = {};
    for (const [k, v] of Object.entries(c)) {
      if (k === "id") continue;
      out[k] = contentOnly(v);
    }
    return out;
  }
  return c;
}

/** A single type that has never been saved 404s with `{ data: null }` — that is
 *  the first-seed case (a fresh instance, or any local dev DB), not an error.
 *  Pass allow404 to treat it as "no document yet". */
async function getJson(path, headers, { allow404 = false } = {}) {
  const res = await fetch(`${STRAPI_URL}${path}`, { headers });
  if (res.status === 404 && allow404) return { data: null };
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`→ ${STRAPI_URL}`);

  process.stdout.write("  fetch current home-page (draft) … ");
  const draftJson = await getJson(`/api/home-page?${HOME_POPULATE}&status=draft`, auth, {
    allow404: true,
  });
  console.log(draftJson.data ? "ok" : "none yet (first seed)");

  process.stdout.write("  fetch current home-page (published) … ");
  const publishedJson = await getJson(`/api/home-page?${HOME_POPULATE}&status=published`, auth, {
    allow404: true,
  });
  console.log(publishedJson.data ? "ok" : "none yet (first seed)");

  const draft = draftJson.data;
  const published = publishedJson.data;

  const draftContent = JSON.stringify(contentOnly(draft));
  const publishedContent = JSON.stringify(contentOnly(published));
  if (draftContent !== publishedContent) {
    console.warn(
      "\n⚠ draft and published home-page content differ — this instance has pending unpublished edits.",
    );
    console.warn("  Writing with ?status=published would publish those edits as a side effect.");
    if (!YES) {
      console.error("✗ Refusing to continue. Re-run with --yes to proceed anyway.");
      process.exit(1);
    }
    console.warn("  --yes passed — continuing anyway.\n");
  }

  const current = draft; // most up-to-date source for the hero merge

  const hero = { ...clean(current?.hero), ...HERO_FIELDS };
  for (const key of ["title", "subtitle"]) {
    if (current?.hero?.[key] && hero[key] !== current.hero[key]) {
      throw new Error(`refusing to write: hero.${key} would change`);
    }
  }

  const data = { hero, trustBar: TRUST_BAR, lifestyle: LIFESTYLE };
  // openDay / journey / buyingGuidesHeader / seo deliberately omitted — see
  // header comment. openDay in particular must never be added here.

  if (DRY_RUN) {
    console.log("\n--dry-run — payload that would be written:\n");
    console.log(JSON.stringify({ data }, null, 2));
    return;
  }

  process.stdout.write("  seed  home-page … ");
  const putRes = await fetch(`${STRAPI_URL}/api/home-page?status=published`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ data }),
  });
  if (!putRes.ok) throw new Error(`home-page → ${putRes.status} ${await putRes.text()}`);
  console.log("ok");

  // Verify what the public (no-token) API the frontend hits actually returns.
  const preWriteHeroTitle = current?.hero?.title ?? null;
  const pub = await getJson(`/api/home-page?${HOME_POPULATE}`, {});
  const p = pub.data ?? {};

  const checks = [
    ["hero.searchCtaLabel === 'Find Dealers'", p.hero?.searchCtaLabel === "Find Dealers"],
    ["hero.title unchanged from pre-write", (p.hero?.title ?? null) === preWriteHeroTitle],
    [
      "trustBar.eyebrow === 'Trusted across Australia'",
      p.trustBar?.eyebrow === "Trusted across Australia",
    ],
    ["trustBar.stats.length === 3", (p.trustBar?.stats?.length ?? 0) === 3],
    [
      "lifestyle.heading === 'The open road is calling'",
      p.lifestyle?.heading === "The open road is calling",
    ],
    ["openDay === null", p.openDay === null],
  ];

  console.log("\nVerification (public API):");
  let failed = false;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failed = true;
  }

  if (failed) {
    console.error("\n✗ one or more verification checks failed.");
    process.exit(1);
  }
  console.log(
    "\nDone. Home Page single type seeded (hero merged, trustBar + lifestyle set, openDay untouched).",
  );
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err.message);
  process.exit(1);
});
