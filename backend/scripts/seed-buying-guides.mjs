// Seed the `buying-guide` collection from the design export's articles.js.
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:guides                 # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:guides   # live
//
// Idempotent: skips any article whose slug already exists. Pass --reset to
// delete every existing buying-guide first (DESTRUCTIVE).
//
// Uses Node 20+ global fetch / FormData / Blob, plus sharp (already a Strapi
// dependency) to downscale images so they fit under the live nginx upload cap.

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import sharp from "sharp";

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;
const RESET = process.argv.includes("--reset");

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.resolve(
  here,
  "../../design-input/CIAA Dealer Directory Website 2.0 Export",
);

const auth = { Authorization: `Bearer ${TOKEN}` };
const MAX_BYTES = 900_000; // keep uploads under the live nginx client_max_body_size

/** Downscale/re-encode an image so it fits under MAX_BYTES. Falls back to the
 *  original bytes for anything sharp can't process. Preserves PNG vs JPEG. */
async function downscale(bytes, filename) {
  try {
    const isPng = /\.png$/i.test(filename);
    const encode = (w, q) => {
      const p = sharp(bytes, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true });
      return (isPng ? p.png({ compressionLevel: 9, palette: true, quality: q }) : p.jpeg({ quality: q, mozjpeg: true })).toBuffer();
    };
    let out = await encode(1600, 80);
    if (out.length > MAX_BYTES) out = await encode(1200, 65);
    return out.length < bytes.length ? out : bytes;
  } catch {
    return bytes;
  }
}

/** Upload one image (local path or remote URL) to the media library → full file object. */
async function uploadFile(src, name) {
  let bytes;
  let filename;
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch image ${src} → ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    filename = `${name}${path.extname(new URL(src).pathname) || ".jpg"}`;
  } else {
    bytes = await readFile(path.join(EXPORT_DIR, src));
    filename = `${name}${path.extname(src) || ".jpg"}`;
  }
  bytes = await downscale(bytes, filename);
  const form = new FormData();
  form.append("files", new Blob([bytes]), filename);
  const res = await fetch(`${STRAPI_URL}/api/upload`, { method: "POST", headers: auth, body: form });
  if (!res.ok) throw new Error(`upload ${filename} → ${res.status} ${await res.text()}`);
  const [file] = await res.json();
  return file;
}

const text = (t) => [{ type: "text", text: t }];

/** Convert an articles.js body[] into Strapi blocks rich-text JSON.
 *  `img` blocks need a real uploaded media object (Strapi validates the shape),
 *  so they're uploaded here. */
async function toBlocks(body, slug) {
  const blocks = [];
  for (let i = 0; i < body.length; i++) {
    const b = body[i];
    switch (b.t) {
      case "h":
        blocks.push({ type: "heading", level: 2, children: text(b.x) });
        break;
      case "ul":
        blocks.push({
          type: "list",
          format: "unordered",
          children: b.items.map((it) => ({ type: "list-item", children: text(it) })),
        });
        break;
      case "tip":
        blocks.push({ type: "quote", children: text(b.x) });
        break;
      case "img": {
        const file = await uploadFile(b.src, `${slug}-body-${i}`);
        blocks.push({
          type: "image",
          image: { ...file, alternativeText: b.caption ?? file.alternativeText ?? "" },
          children: text(""),
        });
        break;
      }
      case "video":
        blocks.push({
          type: "paragraph",
          children: [
            {
              type: "link",
              url: `https://www.youtube.com/watch?v=${b.id}`,
              children: text(b.label ?? "Watch video"),
            },
          ],
        });
        break;
      case "p":
      default:
        blocks.push({ type: "paragraph", children: text(b.x) });
    }
  }
  return blocks;
}

async function existingGuides() {
  const out = [];
  for (const status of ["published", "draft"]) {
    const res = await fetch(
      `${STRAPI_URL}/api/buying-guides?fields[0]=slug&pagination[pageSize]=100&status=${status}`,
      { headers: auth },
    );
    if (!res.ok) throw new Error(`list guides → ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.data);
  }
  return out;
}

async function main() {
  const { ARTICLES } = await import(pathToFileURL(path.join(EXPORT_DIR, "articles.js")).href);
  console.log(`→ ${STRAPI_URL} — ${ARTICLES.length} articles in export`);

  let existing = await existingGuides();

  if (RESET && existing.length) {
    console.log(`--reset: deleting ${existing.length} existing guide(s)…`);
    for (const g of existing) {
      const res = await fetch(`${STRAPI_URL}/api/buying-guides/${g.documentId}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok) throw new Error(`delete ${g.documentId} → ${res.status}`);
    }
    existing = [];
  }

  const have = new Set(existing.map((g) => g.slug));
  let created = 0;
  let skipped = 0;

  for (const a of ARTICLES) {
    if (have.has(a.id)) {
      console.log(`  skip  ${a.id} (already exists)`);
      skipped++;
      continue;
    }
    process.stdout.write(`  seed  ${a.id} … `);

    // Not every article has both images — fall back between them.
    const cardSrc = a.img ?? a.heroUrl;
    const heroSrc = a.heroUrl ?? a.img;
    const cardImage = cardSrc ? (await uploadFile(cardSrc, `${a.id}-card`)).id : null;
    const heroImage = heroSrc ? (await uploadFile(heroSrc, `${a.id}-hero`)).id : null;
    const content = await toBlocks(a.body ?? [], a.id);

    const data = {
      title: a.title,
      slug: a.id,
      category: a.cat ?? null,
      excerpt: a.excerpt ?? null,
      readTime: a.read ?? null,
      featured: Boolean(a.featured),
      author: a.author ?? null,
      cardImage,
      heroImage,
      content,
      seo: {
        metaTitle: a.title.slice(0, 60),
        metaDescription: (a.excerpt ?? a.title).slice(0, 160),
      },
    };

    const res = await fetch(`${STRAPI_URL}/api/buying-guides?status=published`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`create ${a.id} → ${res.status} ${await res.text()}`);
    console.log("ok");
    created++;
  }

  // Verify what the public (no-token) API the frontend uses actually returns.
  const pub = await fetch(
    `${STRAPI_URL}/api/buying-guides?fields[0]=slug&pagination[pageSize]=100`,
  ).then((r) => r.json());
  console.log(
    `\nDone. created=${created} skipped=${skipped}. ` +
      `Public (published) API now returns ${pub.data?.length ?? 0} guide(s).`,
  );
  if ((pub.data?.length ?? 0) < ARTICLES.length) {
    console.warn(
      "⚠ Public count is below the article count — entries may be drafts or the " +
        "Public role lacks find/findOne. Check the bootstrap permission grant.",
    );
  }
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err.message);
  process.exit(1);
});
