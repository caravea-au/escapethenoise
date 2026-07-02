// Seed the `industry-partners` single type with the 12 key industry partner
// logos (downloaded from the reference site, uploaded to Strapi media).
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:industry-partners                 # local
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:industry-partners   # live
//
// The single type is overwritten on each PUT (idempotent content), but each run
// re-uploads the logos — on a re-run, delete the old media in the admin if you
// care about orphans. Uses Node 20+ global fetch/FormData/Blob + sharp.

import sharp from "sharp";

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://127.0.0.1:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}` };
const UA = "Mozilla/5.0 (seed-industry-partners)";

// name, url (partner site), logo (source image to download + upload).
const PARTNERS = [
  { name: "ALKO", url: "https://www.alko.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/ALKO-2.png" },
  { name: "ART", url: "https://www.australianretirementtrust.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2022/03/ART-logo.jpg" },
  { name: "BDO", url: "https://www.bdo.com.au/en-au/home", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/bdo-2.png" },
  { name: "BIG4", url: "https://www.big4.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/BIG4-2.png" },
  { name: "Discovery Parks", url: "https://www.discoveryholidayparks.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/discovery-parks.png" },
  { name: "DLL", url: "https://www.dllgroup.com/en", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/DLL.png" },
  { name: "Dometic", url: "https://store-au.dometic.com/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/Dometic-outdoor.png" },
  { name: "Family Parks", url: "http://www.familyparks.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/family-parks.png" },
  { name: "G'day Parks", url: "https://gdayparks.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2023/05/G-day-Parks-Logo_1-002.png" },
  { name: "Let's Go Insurance", url: "https://www.letsgocaravaninsurance.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/lets-go-insurance.png" },
  { name: "Pedders", url: "http://www.pedders.com.au/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2021/06/pedders.png" },
  { name: "RMS Cloud", url: "https://www.rmscloud.com/", logo: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2026/04/RMS-Blue-background.png" },
];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Download a logo, keep it small (marquee display), upload to Strapi → file id. */
async function uploadLogo(p) {
  const res = await fetch(p.logo, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fetch logo ${p.logo} → ${res.status}`);
  const src = Buffer.from(await res.arrayBuffer());
  const isJpeg = /\.jpe?g$/i.test(p.logo);
  // Downscale to a sensible logo width; preserve PNG transparency vs JPEG.
  const img = sharp(src, { failOn: "none" }).resize({ width: 400, withoutEnlargement: true });
  const out = isJpeg
    ? await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
    : await img.png({ compressionLevel: 9 }).toBuffer();
  const filename = `partner-${slug(p.name)}.${isJpeg ? "jpg" : "png"}`;

  const form = new FormData();
  form.append("files", new Blob([out]), filename);
  const up = await fetch(`${STRAPI_URL}/api/upload`, { method: "POST", headers: auth, body: form });
  if (!up.ok) throw new Error(`upload ${filename} → ${up.status} ${await up.text()}`);
  const [file] = await up.json();
  return file.id;
}

async function main() {
  console.log(`→ ${STRAPI_URL} — ${PARTNERS.length} partner logos`);

  const partners = [];
  for (const p of PARTNERS) {
    process.stdout.write(`  logo  ${p.name} … `);
    const logo = await uploadLogo(p);
    partners.push({ name: p.name, url: p.url, logo });
    console.log("ok");
  }

  const body = { data: { heading: "Key Industry Partners", partners } };
  const put = await fetch(`${STRAPI_URL}/api/industry-partners`, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!put.ok) throw new Error(`put industry-partners → ${put.status} ${await put.text()}`);

  const pub = await fetch(
    `${STRAPI_URL}/api/industry-partners?populate[partners][populate]=logo`,
  ).then((r) => r.json());
  console.log(
    `\nDone. Single type now has ${pub.data?.partners?.length ?? 0} partner(s) with logos.`,
  );
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
