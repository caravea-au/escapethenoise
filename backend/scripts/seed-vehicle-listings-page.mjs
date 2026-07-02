// Seed the `vehicle-listings-page` single type with the page-level copy + SEO
// that previously lived hardcoded in the frontend vehicle-listings/page.tsx.
// (The vehicle cards themselves are the separate `vehicle-listing` collection —
// not touched here.)
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:vehicle-listings-page                 # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:vehicle-listings-page   # live
//
// Idempotent: the single type is overwritten on each PUT. No media is uploaded —
// `seo.ogImage` stays null and the frontend falls back to the site default OG image.

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const PAGE = {
  heroEyebrow: "Find your vehicle",
  heroHeading: "RV Finder connects you with trusted local RV dealers",
  heroLead:
    "From the wonders of the Great Ocean Road to the adventurous Carnarvon Gorge, make sure you know which vehicle can take you there. With room for all the happy campers, big and small, let us help you find a personalised experience.",
  surveyUrl:
    "https://letsgocaravan.typeform.com/to/LEDXVhmR?utm_source=letsgowebsite&utm_medium=vehiclequizpg&utm_campaign=caravanbuyersservice",
  quizButtonLabel: "Not sure? Take the quiz",
  emptyStateText: "Vehicle types are on their way — check back soon.",
  ctaHeading: "Still deciding which RV is right for you?",
  ctaLead:
    "Answer a few quick questions and we'll point you to the vehicles — and dealers — that fit how you travel.",
  ctaButtonLabel: "Not sure? Take the quiz",
  seo: {
    metaTitle: "Find Your Vehicle — RV Finder",
    metaDescription:
      "A free, easy-to-use service that connects you with trusted local RV dealers. Compare camper trailers, camper vans, motorhomes, caravans and more.",
  },
};

/** PUT a single type (no id) with `{ data }`. */
async function putSingle(name, data) {
  process.stdout.write(`  seed  ${name} … `);
  const res = await fetch(`${STRAPI_URL}/api/${name}`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${name} → ${res.status} ${await res.text()}`);
  console.log("ok");
}

async function main() {
  console.log(`→ ${STRAPI_URL}`);
  await putSingle("vehicle-listings-page", PAGE);
  console.log("\nDone. Vehicle Listings Page single type seeded.");
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err.message);
  process.exit(1);
});
