# Project Plan — escape-the-noise

The one place that records **what to build, what data it needs, and whether the servers are ready.**
Filled during `/project-setup` Phase 0 (intake interview). Foundation-first: data + infra before pages.
`/criteria` reads the sitemap; Strapi setup reads the content model.

---

## 1. Sitemap (all pages)

| # | Page | Route | Static / CMS | Depends on (content type) | Build order |
|---|---|---|---|---|---|
| _e.g._ | Home | `/` | mixed | Global, Home Page | 1 |
| | Dealer directory | `/find-a-dealer` | CMS | Dealer | 2 |
| | Dealer profile | `/dealers/[slug]` | CMS | Dealer | 3 |
| | Buying guides | `/guides` | CMS | Guide | … |
| | Guide article | `/guides/[slug]` | CMS | Guide | |
| | Events | `/events` | CMS | Event | |
| | _(fill from the interview)_ | | | | |

## 2. Content model (Strapi)

**Already exists** (read via `strapi_get_content_types`): _list here_ — e.g. Home Page · Global · Blog.

**To create** (foundation-first, before the pages that consume them):

| Content type | Kind | Key fields | Relationships |
|---|---|---|---|
| _e.g._ Dealer | collection | name, slug, suburb, state, accreditation, brands[], phone, website, lat/lng | belongsTo StateAssociation |
| Event | collection | title, slug, date, location, summary, body | — |
| Guide | collection | title, slug, category, readTime, cover, body | — |
| StateAssociation | collection | name, logo, state | hasMany Dealer |
| _(fill from the interview)_ | | | |

## 3. Infrastructure readiness (must be ✅ before per-page dev)

| Item | Status | Notes / fix |
|---|---|---|
| Strapi running locally (`npm run dev:backend`) | ☐ | |
| Strapi staging/prod URL + `NEXT_PUBLIC_STRAPI_URL` set | ☐ | |
| Staging / deploy target reachable (Vercel/Netlify/synergy) | ☐ | |
| Git remote + protected `main` | ☐ | |
| Domain (if known) | ☐ | |
| Design export present in `design-input/` | ☐ | |
| MCP tools connected (`/preflight`) | ☐ | strapi · next-devtools · playwright |

> ❌ on a blocking item → `/criteria` and `/build-component` **wait** until it's green.
