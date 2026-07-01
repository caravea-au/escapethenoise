// Seed the `header` and `footer` single types with the copy that previously
// lived (and was commented out) in Navbar.tsx / Footer.tsx.
//
// Runs against ANY Strapi instance over REST — point it at local or live:
//   STRAPI_TOKEN=<token> npm run seed:header-footer                 # local (default URL)
//   STRAPI_URL=https://cms-... STRAPI_TOKEN=<token> npm run seed:header-footer   # live
//
// Idempotent: single types are overwritten on each PUT. No media is uploaded —
// `logo` stays null and the frontend falls back to its built-in asset/SVG.

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) {
  console.error("✗ STRAPI_TOKEN env var is required (full-access API token).");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const link = (label, url) => ({ label, url });

const HEADER = {
  // Guides-first nav (#10) — topics route to the Buying Guides listing; the
  // hash is the category slug (BuyingGuidesExplorer.slugify) so the listing
  // filters to that category and scrolls to the grid.
  menuItems: [
    link("Education & Safety", "/buying-guides#education-safety"),
    link("Happy Campers", "/buying-guides#happy-campers"),
    link("Towing Guide", "/buying-guides#towing-guide"),
  ],
  ctaButton: link("Visit a Dealer →", "#"),
};

const FOOTER = {
  heading: "Find a Dealer",
  content:
    "The official dealer directory of the Caravan Industry Association of Australia.",
  columns: [
    {
      title: "Find a Dealer",
      links: [
        link("Search dealers", "#"),
        link("Near me", "#"),
        link("Special offers", "#"),
        link("Open now", "#"),
      ],
    },
    {
      title: "Resources",
      links: [
        link("Buying guides", "#"),
        link("Towing guide", "#"),
        link("Events & shows", "#"),
        link("Safety advice", "#"),
      ],
    },
    {
      title: "About CIAA",
      links: [
        link("About us", "#"),
        link("Accreditation", "#"),
        link("For dealers", "#"),
        link("Contact", "#"),
      ],
    },
  ],
  statesLabel: "Browse by state:",
  states: ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((s) => link(s, "#")),
  legalLinks: [link("Privacy", "#"), link("Terms", "#"), link("Accessibility", "#")],
  copyright:
    "© 2026 Caravan Industry Association of Australia · escapethenoise.com.au · 1300 555 000",
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
  await putSingle("header", HEADER);
  await putSingle("footer", FOOTER);
  console.log("\nDone. Header & Footer single types seeded.");
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err.message);
  process.exit(1);
});
