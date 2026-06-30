// Seed the `buying-guide` collection from the design export's articles.js.
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:guides                 # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:guides   # live
//
// Idempotent: skips any article whose slug already exists. Pass --reset to
// delete every existing buying-guide first (DESTRUCTIVE).
//
// No dependencies — uses Node 20+ global fetch / FormData / Blob.

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

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

/** Upload one image (local path or remote URL) to the media library → returns id. */
async function uploadImage(src, name) {
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
  const form = new FormData();
  form.append("files", new Blob([bytes]), filename);
  const res = await fetch(`${STRAPI_URL}/api/upload`, { method: "POST", headers: auth, body: form });
  if (!res.ok) throw new Error(`upload ${filename} → ${res.status} ${await res.text()}`);
  const [file] = await res.json();
  return file.id;
}

const text = (t) => [{ type: "text", text: t }];

/** Convert an articles.js body[] into Strapi blocks rich-text JSON. */
function toBlocks(body) {
  return body.map((b) => {
    switch (b.t) {
      case "h":
        return { type: "heading", level: 2, children: text(b.x) };
      case "ul":
        return {
          type: "list",
          format: "unordered",
          children: b.items.map((it) => ({ type: "list-item", children: text(it) })),
        };
      case "tip":
        return { type: "quote", children: text(b.x) };
      case "img":
        // Body images stay as remote URLs (rendered by a plain <img> in ArticleBody).
        return {
          type: "image",
          image: { url: b.src, alternativeText: b.caption ?? "" },
          children: text(b.caption ?? ""),
        };
      case "video":
        return {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: `https://www.youtube.com/watch?v=${b.id}`,
              children: text(b.label ?? "Watch video"),
            },
          ],
        };
      case "p":
      default:
        return { type: "paragraph", children: text(b.x) };
    }
  });
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

    const cardImage = await uploadImage(a.img, `${a.id}-card`);
    const heroImage = await uploadImage(a.heroUrl, `${a.id}-hero`);

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
      content: toBlocks(a.body ?? []),
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
