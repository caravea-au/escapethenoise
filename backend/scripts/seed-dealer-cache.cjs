// Seed the `dealer` cache from a dealer CSV export.
//
//   node scripts/seed-dealer-cache.mjs <csv>                  # preview, writes nothing
//   node scripts/seed-dealer-cache.mjs <csv> --apply           # write
//   node scripts/seed-dealer-cache.mjs <csv> --apply --limit 3 # write the first 3 only
//
// Run from `backend/`. Boots the real Strapi app, so it reads this environment's
// backend/.env and writes to this environment's database. There is no
// STRAPI_URL: unlike the other seed scripts this one CANNOT go over REST,
// because `dealer` deliberately has no core router (see api/dealer/routes/
// dealers.ts) and therefore no create endpoint. It has to run on the box.
//
// WHY THIS EXISTS. `/find-dealer` reads the `dealer` collection, which is
// normally filled by the Connect sweep (api/integration/services/dealer-sync).
// When Connect has no data to serve, the directory has no other source, so this
// loads a known-good CSV export instead. It is a stand-in for the sweep, not a
// replacement: it writes the same shape the sweep writes, so a later sweep can
// take over.
//
// WHAT IT DELIBERATELY DOES NOT COPY. The CSV is an export of
// `dealer_submissions`, which is full of PII: leads_email, enquiries_email,
// sms_number, contact_name, contact_role, submitter_name/email/phone, abn,
// legal_name, the consent flags and the licence fields. NONE of it is mapped
// below, because `dealer` is served to the public by GET /api/dealers and the
// collection has no attribute for any of it. Do not "helpfully" add one.
//
// That said, the fields it DOES map are dealer-typed and dirty. 19 dealers put a
// business email in the `youtube` field, so an email can reach a public page
// through a field that is supposed to hold a URL. The run reports these rather
// than silently rewriting them: this script is not the place to make content
// decisions, and the Connect sweep would carry the same values anyway.
//
// IDEMPOTENT, and conservative about it: a dealer whose connectRef already
// exists is SKIPPED, never updated. Publication state is the one thing staff own
// on a dealer (ETN-013 D2), and a re-run must not resurrect something they hid.
// Delete a row in the admin if you want this to recreate it.

const { readFileSync } = require('node:fs');

const DEALER_UID = 'api::dealer.dealer';

// Suppress the frontend revalidation ping for this whole run, BEFORE Strapi
// loads. Every create trips api/dealer/content-types/dealer/lifecycles.ts, so
//165 creates would fire 165 HTTP calls to invalidate the same single tag.
//
// Done by clearing the env rather than by importing the sync's
// `withoutRevalidate`: that helper suppresses via a module-scope counter, and a
// standalone .mjs cannot import the TypeScript source at all, while importing a
// compiled copy from dist/ would get a DIFFERENT module instance from the one
// Strapi loaded, leaving the counter the lifecycle reads untouched. Clearing the
// env works because pingRevalidate reads it inside the function and returns
// early when either value is missing.
delete process.env.REVALIDATE_URL;
delete process.env.REVALIDATE_SECRET;

/**
 * Mirror of `isTrustedMediaUrl` in src/utils/trusted-media-url.ts, which is the
 * source of truth and where any change belongs. Duplicated because this script
 * cannot import a .ts module. Keep the two in step.
 *
 * Media URLs land in an <img src> on a public page and
 * syd1.digitaloceanspaces.com is DigitalOcean's SHARED regional endpoint, so
 * host alone is not enough: pin bucket and root path too, or any Spaces
 * customer could choose the images on our directory.
 */
const isTrustedMediaUrl = (value) => {
  if (typeof value !== 'string') return false;
  const host = new URL(
    process.env.DO_SPACE_ENDPOINT || 'https://syd1.digitaloceanspaces.com',
  ).hostname;
  const prefix = `/${[process.env.DO_SPACE_BUCKET, process.env.DO_SPACE_ROOT_PATH]
    .filter(Boolean)
    .join('/')}/`;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && url.pathname.startsWith(prefix);
  } catch {
    return false;
  }
};

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * RFC4180 parser. Hand-rolled because the export quotes `description` fields
 * that contain literal newlines, so splitting on \n corrupts the file: 166 rows
 * arrive as 200-odd lines. Do not replace this with a line-based split.
 */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── cell decoders, matched to what the export actually writes ────────────────
// Verified against dealers-with-coordinates-2026-08-21-connect-ready.csv. The
// export does NOT write JSON for list columns and does NOT write 0/1 for
// booleans, so decoding these by instinct produces silently wrong rows.

const str = (v) => {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
};

/** Booleans are the literal strings TRUE / FALSE, not 0 / 1. */
const bool = (v) => {
  const s = (v ?? '').trim().toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  return null;
};

const int = (v) => {
  const s = (v ?? '').trim();
  if (!/^-?\d+$/.test(s)) return null;
  return Number.parseInt(s, 10);
};

const float = (v) => {
  const s = (v ?? '').trim();
  if (s === '') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * List columns (services, brands, productTypes, photos) are PIPE-JOINED, not
 * JSON: `New sales | Used sales | Servicing`. Safe to split on, because the
 * values are a fixed vocabulary, brand names, or URLs, and a URL cannot contain
 * an unencoded space.
 */
const list = (v) => {
  const s = (v ?? '').trim();
  if (s === '') return [];
  return s
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
};

/** trading_hours IS a JSON object string, unlike every other list column. */
const json = (v) => {
  const s = (v ?? '').trim();
  if (s === '') return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const oneOf = (v, allowed) => {
  const s = (v ?? '').trim();
  return allowed.includes(s) ? s : null;
};

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const STOCK = ['New', 'Used', 'Both'];
const PRECISION = ['street', 'approx'];
const GEOCODE_SOURCE = ['geocoded', 'adjusted', 'imported', 'admin', 'connect'];

// ── mapping ──────────────────────────────────────────────────────────────────

/**
 * `seed|<submission documentId>` matches the shape already loaded on staging.
 * It is deliberately NOT a bare documentId: connectRef is Connect's key space,
 * and a prefixed value can never collide with a real Connect reference, so a
 * later sweep treats these as rows it does not own rather than silently
 * adopting them.
 */
const refFor = (documentId) => `seed|${documentId}`;

function mapRow(get, isTrustedMediaUrl) {
  const documentId = str(get('document_id'));
  const dealershipName = str(get('dealership_name'));
  if (!documentId || !dealershipName) return null;

  // Media URLs go straight into an <img src> on a public page, and
  // syd1.digitaloceanspaces.com is DigitalOcean's SHARED regional endpoint, so
  // an unpinned host would let any Spaces customer choose our images. Same
  // guard the sweep applies, so an untrusted URL is never stored.
  const logo = str(get('logo'));
  const photos = list(get('photos')).filter((url) => isTrustedMediaUrl(url));

  return {
    connectRef: refFor(documentId),
    // Left null on purpose: this is Connect's submission id, and these rows did
    // not come from Connect. Writing our own documentId here would claim a
    // provenance that does not exist.
    connectSubmissionId: null,

    dealershipName,
    street: str(get('street')),
    suburb: str(get('suburb')),
    state: oneOf(get('state'), STATES),
    postcode: str(get('postcode')), // string, so leading zeros survive
    phone: str(get('phone')),
    website: str(get('website')),
    description: str(get('description')),

    logo: logo && isTrustedMediaUrl(logo) ? logo : null,
    photos,

    facebook: str(get('facebook')),
    instagram: str(get('instagram')),
    youtube: str(get('youtube')),
    googleProfile: str(get('google_profile')),

    tradingHours: json(get('trading_hours')),
    services: list(get('services')),
    servicesOther: str(get('services_other')),
    brands: list(get('brands')),
    brandsOther: str(get('brands_other')),
    productTypes: list(get('product_types')),
    productsOther: str(get('products_other')),

    stockCondition: oneOf(get('stock_condition'), STOCK),
    financeAvailable: bool(get('finance_available')),
    deliveryAvailable: bool(get('delivery_available')),
    rvmapBadged: bool(get('rvmap_badged')),
    rvmasterBadged: bool(get('rvmaster_badged')),
    established: int(get('established')),
    multipleLocations: bool(get('multiple_locations')),
    stateAssociation: str(get('state_association')),

    latitude: float(get('latitude')),
    longitude: float(get('longitude')),
    precision: oneOf(get('precision'), PRECISION),
    geocodeSource: oneOf(get('geocode_source'), GEOCODE_SOURCE),
    matchedAddress: str(get('matched_address')),
    geocodedAddress: str(get('geocoded_address')),

    // Approval is Connect's to grant and drives the accreditation pill. Nothing
    // in a CSV export can assert it, so every seeded dealer starts unapproved.
    approved: false,

    // Sweep bookkeeping. sourceHash stays null so the FIRST real sweep sees
    // these as changed and rewrites them from Connect rather than skipping on a
    // hash it never computed.
    sourceHash: null,
    sourceStatus: 'live',
    missingSince: null,
    syncedAt: null,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number.parseInt(args[limitArg + 1], 10) : Infinity;

  if (!csvPath) {
    console.error('✗ usage: node scripts/seed-dealer-cache.mjs <csv> [--apply] [--limit N]');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const header = rows[0];
  const dataRows = rows.slice(1).filter((r) => r.length > 1);

  const missingColumns = ['document_id', 'dealership_name', 'state'].filter(
    (c) => !header.includes(c),
  );
  if (missingColumns.length) {
    console.error(`✗ CSV is missing required columns: ${missingColumns.join(', ')}`);
    process.exit(1);
  }

  // stderr, so --map-only can emit clean JSON on stdout for piping.
  console.error(`CSV: ${csvPath}`);
  console.error(`  ${header.length} columns, ${dataRows.length} data rows`);

  // --map-only stops here: it prints what the CSV decodes to and never touches a
  // database, so the risky part (the decoders below) can be checked on any machine
  // without booting Strapi or installing the backend workspace. The @strapi/strapi
  // import is dynamic for exactly that reason.
  if (args.includes('--map-only')) {
    const mapped = dataRows
      .map((row) => mapRow((name) => row[header.indexOf(name)], isTrustedMediaUrl))
      .filter(Boolean);
    console.log(JSON.stringify(mapped, null, 2));
    process.exit(0);
  }

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();

  try {
    // One read of every existing ref, rather than a query per row.
    const existing = await app.db.query(DEALER_UID).findMany({ select: ['connectRef'] });
    const seen = new Set(existing.map((r) => r.connectRef).filter(Boolean));
    console.log(`  ${seen.size} dealers already in the cache`);

    const planned = [];
    let skippedExisting = 0;
    let unmappable = 0;

    for (const row of dataRows) {
      const get = (name) => row[header.indexOf(name)];
      const data = mapRow(get, isTrustedMediaUrl);
      if (!data) {
        unmappable += 1;
        continue;
      }
      if (seen.has(data.connectRef)) {
        skippedExisting += 1;
        continue;
      }
      planned.push(data);
    }

    const toWrite = planned.slice(0, limit);

    console.log('');
    console.log(`  to create : ${toWrite.length}${planned.length > toWrite.length ? ` (of ${planned.length}, --limit)` : ''}`);
    console.log(`  skipped   : ${skippedExisting} already present`);
    console.log(`  unmappable: ${unmappable} (no document_id or dealership_name)`);
    const pinned = toWrite.filter((d) => d.latitude !== null && d.longitude !== null).length;
    console.log(`  pins      : ${pinned} with coordinates, ${toWrite.length - pinned} without`);
    const states = {};
    for (const d of toWrite) states[d.state ?? 'NULL'] = (states[d.state ?? 'NULL'] ?? 0) + 1;
    console.log(`  states    : ${JSON.stringify(states)}`);
    const noLogo = toWrite.filter((d) => !d.logo).length;
    console.log(`  media     : ${toWrite.length - noLogo} with a trusted logo, ${noLogo} without`);

    // Link fields that do not look like a link. These end up in an <a href> on a
    // public page, so a value like "ben@example.com" in `youtube` renders as a
    // broken social link. Reported, never rewritten. See the header note.
    const LINK_FIELDS = ["website", "facebook", "instagram", "youtube", "googleProfile"];
    const looksLikeLink = (v) =>
      /^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v);
    const suspect = [];
    for (const d of toWrite) {
      for (const f of LINK_FIELDS) {
        const v = d[f];
        if (typeof v === "string" && v && !looksLikeLink(v)) suspect.push(`${d.dealershipName} .${f} = ${v}`);
      }
    }
    if (suspect.length) {
      console.log("");
      console.log(`  ⚠ ${suspect.length} link field(s) do not look like a URL and will render as broken links:`);
      for (const line of suspect.slice(0, 25)) console.log(`      ${line}`);
      if (suspect.length > 25) console.log(`      ... and ${suspect.length - 25} more`);
      console.log("  Fix them in the source data if that matters; this script will not guess.");
    }

    if (!apply) {
      console.log('');
      console.log('DRY RUN. Nothing written. Re-run with --apply to create these.');
      console.log('Sample of the first row that would be created:');
      console.log(JSON.stringify(toWrite[0], null, 2).slice(0, 1400));
    } else {
      console.log('');
      let created = 0;
      const failures = [];
      for (const data of toWrite) {
        try {
          // `status: 'published'` so the row is live immediately. A draftAndPublish
          // collection needs BOTH versions, and the document service writes the
          // pair; a raw SQL insert would create a draft the public endpoint
          // (which filters on publishedAt) never returns.
          await app.documents(DEALER_UID).create({ data, status: 'published' });
          created += 1;
          if (created % 25 === 0) console.log(`  ... ${created}/${toWrite.length}`);
        } catch (error) {
          failures.push(`${data.connectRef} (${data.dealershipName}): ${error?.message ?? error}`);
        }
      }
      console.log('');
      console.log(`✓ created ${created} published dealers`);
      if (failures.length) {
        console.log(`✗ ${failures.length} failed:`);
        for (const f of failures.slice(0, 20)) console.log(`   ${f}`);
      }
      const after = await app.db.query(DEALER_UID).count({ where: { publishedAt: { $notNull: true } } });
      console.log(`  published dealers now in the cache: ${after}`);
      console.log('');
      console.log('The frontend caches the dealer list for 60s, so allow a minute');
      console.log('(or set REVALIDATE_URL/REVALIDATE_SECRET) before checking /find-dealer.');
    }
  } finally {
    await app.destroy();
  }

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
