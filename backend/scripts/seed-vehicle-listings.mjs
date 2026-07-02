// Seed the `vehicle-listing` collection from vehicle-listings-data.mjs.
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:vehicles                 # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:vehicles   # live
//
// Idempotent: skips any vehicle whose slug already exists (but backfills the
// card/hero image onto an existing entry that has none). Pass --reset to delete
// every existing vehicle-listing first (DESTRUCTIVE).
//
// Each vehicle's `cardImage` (a source photo URL) is DOWNLOADED and re-uploaded
// into Strapi media, then attached as both cardImage and heroImage — the stored
// value is a Strapi media relation, never a link to the source page. Uses
// Node 20+ global fetch/FormData/Blob + sharp.

import sharp from "sharp";
import { VEHICLES } from "./vehicle-listings-data.mjs";

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;
const RESET = process.argv.includes("--reset");

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}` };
const UA = "Mozilla/5.0 (seed-vehicle-listings)";
const MAX_BYTES = 900_000; // keep under the live nginx upload cap

/** Download a source photo, downscale, upload to Strapi media → file id. */
async function uploadImage(url, name) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch image ${url} → ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());
  const isPng = /\.png$/i.test(url);
  const encode = (w, q) => {
    const p = sharp(src, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true });
    return (isPng ? p.png({ compressionLevel: 9 }) : p.jpeg({ quality: q, mozjpeg: true })).toBuffer();
  };
  let out = await encode(1600, 80);
  if (out.length > MAX_BYTES) out = await encode(1200, 68);
  const filename = `vehicle-${name}.${isPng ? "png" : "jpg"}`;
  const form = new FormData();
  form.append("files", new Blob([out]), filename);
  const up = await fetch(`${STRAPI_URL}/api/upload`, { method: "POST", headers: auth, body: form });
  if (!up.ok) throw new Error(`upload ${filename} → ${up.status} ${await up.text()}`);
  const [file] = await up.json();
  return file.id;
}

// ── transforms ───────────────────────────────────────────────────────────────

// Pick a spec-section icon from the bullet text. Ordered most-specific first;
// anything unmatched falls back to a check (SpecIcon default on the frontend).
function iconFor(text) {
  const t = text.toLowerCase();
  const rules = [
    ["solar", /solar/],
    ["battery", /battery|charger/],
    ["aircon", /air condition|air-condition|aircon|heating|diesel heat/],
    ["fridge", /fridge|freezer/],
    ["kitchen", /kitchen|cook|hot plate|cooktop|oven|microwave|induction/],
    ["water", /water|sink|shower|toilet|ensuite|bathroom|vanity|laundry|washer|dryer/],
    ["awning", /awning|outdoor|al fresco|annexe/],
    ["solar", /inverter/],
    ["power", /12v|240v|mains|power|usb|charg|inverter|satellite|connectivity|tv|entertainment|speaker|lighting|mood light/],
    ["storage", /storage|locker|cabinetry|cupboard/],
    ["bed", /sleep|bed|solo|couple|famil|people|capacity/],
    ["license", /licen[cs]e/],
    ["road", /road|terrain|tow|4wd|suv|sedan|off-road|touring|drive|manoeuvr|reversing|axle|fuel|track|navigation|slide-out|visibility/],
  ];
  for (const [icon, re] of rules) if (re.test(t)) return icon;
  return "check";
}

const paragraph = (t) => ({ type: "paragraph", children: [{ type: "text", text: t }] });

function toPayload(v) {
  return {
    title: v.title,
    slug: v.slug,
    order: v.order,
    priceFrom: v.priceFrom ?? null,
    watchVideoUrl: v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : null,
    // Card shows up to three feature bullets — reuse the top "why choose" points.
    cardFeatures: v.whyChoose.slice(0, 3).map((text) => ({ text, icon: null })),
    whyChoose: v.whyChoose.map((text) => ({ text, icon: null })),
    overviewHeading: v.overviewHeading ?? null,
    overviewBody: (v.overview ?? []).map(paragraph),
    specSections: (v.specSections ?? []).map((s) => ({
      label: s.label,
      body: null,
      items: (s.bullets ?? []).map((text) => ({ text, icon: iconFor(text) })),
    })),
    seo: {
      metaTitle: v.title.slice(0, 60),
      metaDescription: (v.overview?.[0] ?? v.title).slice(0, 160),
    },
  };
}

// ── REST helpers ─────────────────────────────────────────────────────────────

async function existingVehicles() {
  const out = [];
  for (const status of ["published", "draft"]) {
    const res = await fetch(
      `${STRAPI_URL}/api/vehicle-listings?fields[0]=slug&populate[cardImage]=true&pagination[pageSize]=100&status=${status}`,
      { headers: auth },
    );
    if (!res.ok) throw new Error(`list vehicles → ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.data);
  }
  return out;
}

async function main() {
  console.log(`→ ${STRAPI_URL} — ${VEHICLES.length} vehicles in data module`);

  let existing = await existingVehicles();

  if (RESET && existing.length) {
    console.log(`--reset: deleting ${existing.length} existing vehicle(s)…`);
    for (const g of existing) {
      const res = await fetch(`${STRAPI_URL}/api/vehicle-listings/${g.documentId}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok) throw new Error(`delete ${g.documentId} → ${res.status}`);
    }
    existing = [];
  }

  const bySlug = new Map(existing.map((g) => [g.slug, g]));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const v of VEHICLES) {
    const ex = bySlug.get(v.slug);

    if (ex && ex.cardImage) {
      console.log(`  skip  ${v.slug} (exists, has image)`);
      skipped++;
      continue;
    }

    // Upload the card/hero photo (download → downscale → Strapi media).
    const imageId = v.cardImage ? await uploadImage(v.cardImage, v.slug) : null;

    if (ex) {
      // Backfill image onto an existing entry (partial update; ensureSlug leaves
      // the slug alone because the payload carries no title/slug).
      process.stdout.write(`  image ${v.slug} … `);
      const res = await fetch(`${STRAPI_URL}/api/vehicle-listings/${ex.documentId}`, {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { cardImage: imageId, heroImage: imageId } }),
      });
      if (!res.ok) throw new Error(`update ${v.slug} → ${res.status} ${await res.text()}`);
      console.log("ok");
      updated++;
      continue;
    }

    process.stdout.write(`  seed  ${v.slug} … `);
    const data = toPayload(v);
    if (imageId) {
      data.cardImage = imageId;
      data.heroImage = imageId;
    }
    const res = await fetch(`${STRAPI_URL}/api/vehicle-listings?status=published`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`create ${v.slug} → ${res.status} ${await res.text()}`);
    console.log("ok");
    created++;
  }

  // Verify what the public (no-token) API the frontend uses actually returns.
  const pub = await fetch(
    `${STRAPI_URL}/api/vehicle-listings?fields[0]=slug&pagination[pageSize]=100`,
  ).then((r) => r.json());
  console.log(
    `\nDone. created=${created} updated=${updated} skipped=${skipped}. Public API now returns ${pub.data.length} published vehicle(s).`,
  );
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
