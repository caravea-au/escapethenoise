---
name: site-api-inventory-cache
description: >
  How Caravea sites consume the shared Site API (hub.caravea.au) for inventory (caravans, in-stock,
  events) WITHOUT tripping its rate limit or anti-DDoS. Use whenever a task fetches, lists, or builds
  pages from the Site API, plans inventory/detail routes, touches the Strapi integration/inventory
  proxy, or wires build-time data for caravan/model/event pages. The rule: never live-fetch the Site
  API at build or from the frontend — Strapi is the cache, one paced delta sync owns upstream.
---

# Site API inventory cache

The Caravea **Site API** (`https://hub.caravea.au/api/site`) is on Synergy **shared hosting** with hard
limits that already got our IP **blocked once**. Every rule below prevents that from happening again.

## Why (the constraints that bite)

- **Rate limit: 60 req/min.** Exceeding it does not 429 politely, it **times out**. Target budget: **~20 req/min**.
- **200 concurrent connections**, shared across *all* customers on the host. Not our budget to spend.
- **Per-source-IP anti-DDoS.** It was triggered by burst traffic + new-connection-per-request. There is
  **no IP whitelist** on shared hosting. Multiple Caravea sites egress from **one IP**, so the anti-DDoS
  sees them as a single client: budgets must be treated as **global to the host**, not per-site.
- **N+1 API shape.** One LIST call returns all items; then it is **one DETAIL call per item** (e.g. Full
  Range = 1 + ~85 = 86 requests; a full cold build is ~150-250 requests). A naive SSG build bursts all of
  these at once, which is exactly the ban scenario.

## The non-negotiables

1. **Never fetch the Site API from the Next.js build or the frontend. Ever.**
   Build-time `fetch()` of `hub.caravea.au`, `generateStaticParams` hitting upstream, client components
   calling it, all forbidden. If you see it, that is the bug.

2. **Strapi is the materialized cache and the single source of truth for inventory.**
   The frontend and the build read caravans/events from **local Strapi** only.

3. **Exactly ONE paced delta-sync job owns the upstream relationship**, and it runs **off the build
   critical path** (a Strapi cron, not `next build`). One writer, never N builders.

4. **Delta, not full sweep.** Every record carries a `modified` timestamp and each list response carries
   `last_modified`. Call the LIST endpoint (1 request), diff `modified` against the stored cursor, and
   fetch DETAIL **only for new/changed uids**. A steady-state sync is ~1 request per model.

5. **Pace like a well-behaved single client:** ≤20 req/min via token spacing (add jitter), concurrency
   ≤2, a keep-alive agent with `maxSockets: 2`, exponential backoff, and honor `Retry-After`. The budget
   is **global**, not per-call.

6. **Fail toward last-good, never toward upstream.** If the cache/sync is unavailable, serve the last
   materialized rows or an empty/error state. Never "fall back" to a direct Site API call, that
   reintroduces the burst.

7. **Freshness is ISR + on-demand revalidation, not rebuilds.** Detail routes set `dynamicParams = true`
   (new items render lazily on first request) and `revalidate`; the sync job pings a shared-secret
   `/api/revalidate` (`revalidateTag`/`revalidatePath`) after a change so edits appear without a rebuild.

## Data flow

```
hub.caravea.au/api/site
      │  ONE paced delta sync (Strapi cron, ≤20 req/min, only changed uids)
      ▼
  Strapi content types  (caravan, event)  ← the cache / source of truth
      │  build + frontend read LOCAL Strapi only  (0 upstream calls)
      ▼
  Next.js pages (SSG + ISR)  ──  /api/revalidate  ◄── sync pings on change
```

## What to build (shape)

- **Strapi**: `caravan` + `event` collection types (store mapped fields + `sourceModified` + `rawDetail`
  json + `syncedAt`); an `integration-setting` single type holding upstream creds **and delta cursors**
  (`caravanListModified`, `eventsListModified`, `lastSyncAt`, `lastSyncStatus`); a `site-api-client`
  service (paced/backoff) + an `inventory-sync` service (list → diff → detail → upsert → soft-unpublish
  removed → update cursors); a cron in `config/cron-tasks.ts`; a `POST /api/integrations/inventory/sync`
  for cold-fill/manual refresh; public find/findOne granted in `src/index.ts`.
- **Next.js**: `lib/inventory.ts` fail-soft fetchers over the Strapi endpoints (mirror `lib/strapi.ts`,
  return null/[] never throw); `app/api/revalidate/route.ts` (secret-guarded); detail routes with
  `generateStaticParams` from the cached slugs, `dynamicParams = true`, `revalidate`, and tagged fetches.

## Reference implementation & docs

- Canonical implementation lives in the **baseplate**: `backend/src/api/{integration-setting,caravan,event,integration}/`,
  `frontend/src/lib/inventory.ts`, `frontend/src/app/api/revalidate/route.ts`.
- Full rationale + ops (cold-fill, staleness, monitoring): `docs/SITE-API-CACHE-ARCHITECTURE.md`.
- Endpoint reference: `docs/site-api.md`. Content types: `docs/STRAPI-CONTENT-TYPES.md`.
- Prior art (live-fetch, do NOT copy the no-cache behavior): snowyrivergeelong `full-range-catalog.ts`
  (good paced-fetch constants: concurrency 2, ~150ms stagger, 8 attempts, backoff) but its 5-min
  in-memory cache empties on restart, which is the anti-pattern this skill replaces.
