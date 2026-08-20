# /find-dealer and the Caravea Connect dealer cache

`/find-dealer` reads **Strapi**. Strapi holds a **cache** of the Caravea Connect dealer feed, filled by
a cron sweep, and that cache carries one thing Connect does not know about: a **local publication
gate**. Unpublish a dealer in Strapi and they leave the directory even though Connect keeps sending
them.

This is the OUTBOUND direction (Connect to us). The inbound direction — a dealer onboarding submission
forwarded to Connect — is a separate, already-shipped path and is untouched by any of this.

## Why it is a cache and not a live read

Until ETN-013 the page called Connect on every render. That made Connect simultaneously the source of
truth, the availability dependency, **and** the only place dealer visibility could be controlled.
Every problem followed from that one fact:

- Visibility could only be changed by Connect or by a code deploy.
- An upstream change became a client-facing content outage in under five minutes. On **2026-08-20**
  staging Connect started answering `meta.total: 0`, `/find-dealer` reported "0 caravan dealers", and
  nothing alerted — because the page was behaving exactly as designed. On **2026-08-17** Connect
  flattened its list shape, all 119 records mapped to `null`, and the page cheerfully announced that
  no dealers existed.
- Every enquiry submission cost a scan of up to 20 pages of Connect's list just to name the dealer it
  was for.

A cache fixes all three, and the publication gate is only possible once the data is local.

## The pipeline

```
Caravea Connect   GET /api/public/dealer-registrations?source=nobettertime&per_page=100
      |   ONE job owns the read: a Strapi cron sweep. Never the build, never the
      |   frontend, never a request path.
      v
Strapi `dealer` collection      <- the cache AND the publication gate
      |   draft/publish is EDITORIAL and locally owned. The sweep writes the
      |   DRAFT and publishes only what is already published.
      v
GET /api/dealers  (published only)   ->   /find-dealer
```

| Piece | File |
| --- | --- |
| Feed read + mapping (the only place Connect's shape is understood) | `backend/src/utils/connect-dealer-feed.ts` |
| The sweep | `backend/src/api/integration/services/dealer-sync.ts` |
| Schedule + master switch | `backend/config/cron-tasks.ts`, `backend/config/server.ts` |
| Manual "refresh now" | `POST /api/integrations/dealers/sync` (API token required) |
| Public read | `backend/src/api/dealer/{routes/dealers.ts,controllers/dealer.ts,dto/public-dealer.ts}` |
| Instant path for the publish toggle | `backend/src/api/dealer/content-types/dealer/lifecycles.ts` → `frontend/src/app/api/revalidate/route.ts` |
| Frontend getter | `getDirectoryDealers()` in `frontend/src/lib/strapi.ts` |
| Enquiry resolution | `backend/src/utils/dealer-cache-lookup.ts` |

### THE ONE RULE

> **The sweep writes the draft and publishes only what is already published.**

`caravea-nextjs-baseplate`'s `inventory-sync.ts` calls `publish()` on every *unchanged* row on every
pass. Copy that and a dealer staff unpublished is silently republished within one cron interval, which
is the entire feature. Nothing would fail; it would just quietly stop working.

## Environment

Both directions share one credential pair, in **`backend/.env` only** — the frontend no longer reads
Connect at all.

| Var | Effect |
| --- | --- |
| `CONNECT_API_URL`, `CONNECT_API_KEY` | Without both, every sweep fails on rail 1 and writes nothing. |
| `CONNECT_SYNC_ENABLED` | Master switch, **defaults false**. Gates cron registration, so staging and production are independent. |
| `CONNECT_SYNC_CRON` | Optional override. Default `*/10 * * * *`. |
| `REVALIDATE_URL`, `REVALIDATE_SECRET` | Optional. Unset means a publish takes up to 60s to show instead of appearing on the next load. Secret must match the frontend's. |

There is a third guard in the database: `connectSyncEnabled` on the **Integration Setting** single
type, so an admin can stop the sweep on one environment without a deploy. That single type is also
where `lastSyncAt` / `lastSyncStatus` / `lastSyncSummary` are written, so "did it run and did it work"
is answerable from the admin panel rather than from pm2 logs. **Credentials are deliberately NOT in
the database** — putting operational secrets there is what armed real SMTP against real dealer
addresses when a live `data.db` was copied down for local work.

## Safety rails

Each one is the difference between a cache and a slower outage. All were exercised against a stub feed
before shipping.

| # | Rail | Behaviour |
| --- | --- | --- |
| 1 | Incomplete read | `fetchConnectDealerFeed` **throws** rather than returning a short feed (unreachable page, non-JSON body, more pages than the 20-page cap). A throw writes nothing. |
| 2 | Zero records | No-op, `lastSyncStatus: failed`. The page keeps the last-good set. This is the 2026-08-20 scenario. |
| 3 | Records in, none mapped | No-op, `failed`. That is a shape change, not an empty directory. This is the 2026-08-17 scenario. |
| 4 | Bulk-disappearance brake | More than **20%** of cached dealers absent in one sweep: mark **none** of them, fail for a human. |
| 5 | Never delete, never unpublish | A dealer who vanishes upstream is flagged `sourceStatus: missing` with `missingSince`, and **stays listed**. Unpublishing would overload the editorial state, and a returning dealer would then resurrect one staff had deliberately hidden. |
| 6 | Unchanged costs zero writes | No write, no `publish()`, no `updatedAt` churn, so the admin's "Modified" badge means something. |

Change detection is a **content hash** of the mapped payload, not the baseplate's `sourceModified`
delta cursor: Connect's rows carry `submitted_at`, `approved_at`, `rejected_at` and `processed_at`,
and **none of them moves when a dealer edits their own profile**.

## Latency

| Hop | Mechanism | Latency |
| --- | --- | --- |
| Connect → Strapi | cron sweep, 10 min | 0–10 min |
| Strapi → page | Next data cache, `revalidate: 60`, tag `dealers` | up to 60s, plus one page view to trip it |
| **Connect edit → visible** | both | **worst case ~11 min** |
| **Staff publish/draft → visible** | lifecycle pings `/api/revalidate` | **next page load** (measured at ~1s) |

Two properties of that second hop are worth knowing: Next's data cache is stale-while-revalidate, so
the first visitor after expiry still sees the old data and only triggers the refresh; and it does not
move at all without traffic. The publish toggle gets its own instant path **because it is the only
human-facing action left on a dealer** — staff flip one and immediately reload the page.

The sweep deliberately does **not** ping (`withoutRevalidate` suppresses it): a first sweep of 180
dealers would otherwise fire 180 HTTP calls to invalidate one tag.

Verify caching against `npm run build && npm start`, never `next dev` — dev uses a different fetch
cache and gives a false reading either way.

## Coordinates

Coordinates are the ONE thing the cache owns rather than mirroring. **Connect stores no precision
field**, so every coordinate it sends is approximate by construction and every distance label built
from one keeps its `~`. Our own `dealer_submissions` table holds pins dealers placed themselves,
pins staff corrected, and geocodes verified against the right road.

Resolution is **precision-ranked, not source-ranked**, which makes it order-independent — there is no
"run the migration before the first sweep" hazard:

1. A pin a human placed (`geocodeSource` `admin` or `adjusted`) — outranks any geocode.
2. `street` precision.
3. `approx` precision.
4. Nothing.

Ties go to the pin already cached, so a settled dealer produces no write. Measured against the
163-dealer fixture: **street pins 0 → 128** among participating dealers (0 pre-swap, by construction),
own coordinates 95 → 141, map markers 142 → 144.

Matching a Connect dealer to one of our onboarding rows is name + postcode first, then a website
**domain stem** (TLD-insensitive: the same dealership appears as `.com.au` in one system and `.com` in
the other). A key with several candidate pins is **not** automatically ambiguous — 11 of the 12
duplicated name+postcode groups in this data are the same dealership entered twice, agreeing to
0.0000 km, and discarding them cost 11 street pins. The rule takes the highest-ranked pin and gives up
only when two pins of the **same** top rank are more than 100 m apart. That last case matters most for
the website index, where a collision means several LOCATIONS sharing one corporate site — 37 of ~161
dealers do.

**Known trade-off:** a street pin is never downgraded, so if a dealer moves and Connect updates their
address, the old pin keeps winning. The fix is manual and cheap — clear the coordinate fields on that
dealer in the admin and the next sweep re-resolves them.

## Who owns what

| | Owner |
| --- | --- |
| Every display field | **Connect.** The sweep overwrites freely. Fix a wrong phone number on Connect, not in Strapi, or it reverts within one cron interval. |
| Publication state (visible / hidden) | **Strapi.** Never touched by the sweep except to publish what is already published. |
| The six coordinate fields | **Local**, per the ranking above. |
| `approved` | Connect. **Badge only** — see below. |
| Participating-states narrowing | The **page** (`PARTICIPATING_STATES` in `frontend/src/lib/dealers.ts`, ETN-012). Deliberately not the sweep: the cache holds every dealer Connect sends, so a delisted dealer can still receive an enquiry through a held link. |

This is why ETN-009's objection to a local hide-list does not apply: Connect keeps 100% ownership of
dealer content, and the only locally owned editorial bit is one boolean-shaped state Connect has no
field for. There is nothing for the two systems to disagree *about*.

## Approval and the enquiry form

`approved` drives the `✓ Accredited` badge and **nothing else** (ETN-006). Every dealer gets an
enquiry form regardless of approval (ETN-010). **Visibility is the publish toggle**, not approval.

Connect is still adding an explicit approval boolean; it was absent from all 119 records on
2026-08-17, so the reader checks `approved` / `is_approved` / `isApproved` first, then falls back to
`status === "approved"` and `approved_at`. Unrecognisable state reads as **not** approved. When the
real field ships, confirm its name and drop the fallbacks.

Enquiries resolve the dealer **locally** now — one indexed read, replacing the up-to-20-request scan
of Connect's list. `dealer-submission` is checked first (so an enquiry from a page cached before any
of these swaps still works), then the `dealer` cache. Two things are enforced, both as gates:

- The dealer must **exist**. An enquiry is a lead with a consumer's contact details attached.
- The dealer must be **published** (ETN-013 D3). A hidden dealer's form is gone from their card, but a
  held link or a plain `curl` would otherwise still file leads against a dealership the client has
  delisted. A hidden dealer and an id that was never real answer **identically** — telling an enquirer
  that a dealership exists but has been delisted is not ours to disclose.

`sourceStatus` is deliberately not part of that gate: a dealer flagged `missing` stays listed, so they
must stay reachable, or their live card would carry a form that silently fails.

The dealership name is taken from the resolved row, never from the request body — it is denormalised
onto the stored enquiry, so a client-settable name would let anyone write whatever they liked into an
admin's view of who a lead was for.

## Measured Connect API behaviour (re-verified 2026-08-17 against staging)

- **`source=nobettertime` is required on every request.** Omit it and Connect does not 400 — it
  **302s to its own login page**, which then "succeeds" as HTML and fails to parse. Both readers use
  `redirect: 'manual'` so that becomes a non-ok response. This is also why `links.next` is never
  followed: their pagination URLs drop the parameter.
- **`per_page` is honoured and the parameter NAME is load-bearing.** Default 10, maximum 100
  (`per_page=200` → `422`). `limit` / `page_size` / `pageSize` are **ignored** and fall through to 10.
  We send 100, which reads ~119 registrations in 2 requests instead of 12. Paginate with `page=N` and
  read `meta.last_page`.
- **No server-side status filter.** `?status=approved` → `422 {"message":"Status filtering is not
  available"}`. No `?reference=` filter either; it is ignored and the full list comes back.
- **No per-record modified timestamp** — hence the content hash.
- **A by-id read exists but the list can no longer reach it.**
  `GET /api/public/dealer-registrations/{submission_id}` works and returns the OLD nested tree, but
  only accepts the ULID `submission_id`, which the list stopped emitting. `reference` /
  `caravea_company_id` **404** there, raw and URL-encoded.
- No key at all returns `401`.
- **A push webhook exists but is dormant.** Connect offers HMAC-signed `dealer.approved` and
  `company_information.updated` events and sends nothing until *their* ops set `NOBETTERTIME_SYNC_URL`
  and `NOBETTERTIME_SYNC_SECRET`. Not a dependency; it is the upgrade path from ~11 minutes to seconds.

### Two response shapes, both read

Connect's own two endpoints disagree, so `normaliseRecord` lifts both before mapping:

```
OLD  data[] = { submission_id, source, status, submitted_at, processed_at,
                company: { reference, caravea_company_id, status, approved_at, …,
                           company:{…profile}, location:{…}, information:{…} } }

NEW  data[] = { reference, caravea_company_id, source, status, submitted_at,
                approved_at, rejected_at, rejection_reason,
                company:{…profile}, location:{…}, information:{…} }
```

The tell is `company.company`: an object there means the old wrapper is still present. A structural
check, because Connect ships no version flag. The list returns the new shape; the by-id show endpoint
still returns the old one.

`connectRef` — the cache's match key, and what `/api/dealers` publishes as `documentId` — is
`reference`, falling back to `caravea_company_id` then `submission_id`. It is **not** the Strapi
documentId of the cache row, deliberately: it has to survive the cache being rebuilt from scratch, or
every enquiry ever filed would lose its subject.

## Field mapping traps

`toDealerRecord` builds each row by explicit assignment and **never spreads a Connect record**.
Connect's response contains `owner_email`, `abn`, `legal_name`, `leads_email`, `sms_number`, the
submitter contact block, licence numbers and the consent flags. None are mapped, and the `dealer`
collection has no column for any of them — which is also why there is **no raw-payload blob** here,
unlike the baseplate's inventory cache.

1. **`company.open_hours` is rendered HTML** (`"<p>Monday: 8:30-17:00</p>"`). Never read. Storing
   Connect-authored HTML and printing it would be stored XSS. The structured
   `information.trading_hours` is used instead.
2. **Coordinates come back as decimal STRINGS** (`"-37.82530000"`), so a `typeof x === "number"` guard
   silently drops every pin.
3. **Media URLs are free-text strings that end up in `<img src>`.** Pinned to host + bucket + root
   path (`backend/src/utils/trusted-media-url.ts`), because `syd1.digitaloceanspaces.com` is
   DigitalOcean's shared regional endpoint — host alone would let any Spaces customer choose the
   images on our directory. Unset vars reject every image: a visible failure beats a silent widening.
   This check now runs once, at sweep time, so an untrusted URL is never stored.
4. **`state` is an enum on the cache**, and `location.state_province` is free text. It is normalised to
   the eight AU abbreviations; anything else reads as `null`, and a dealer with no state is correctly
   excluded by `participatingDealers`. Passing the raw value through would make Strapi reject the whole
   record, turning one bad row into a failed sweep.
5. **`established` is a plain year** but one real row carries `25`. Out-of-range values read as absent.

## Current state and what is still owed

Connect staging held **119 registrations** on 2026-08-17 (116 real dealers from the CSV import plus 3
test rows of our own), 113 with coordinates, **every one `status: pending`**. On **2026-08-20 the same
instance returned `meta.total: 0`** — the event that motivated this cache.

Still owed by Connect:

1. **An approval field**, so the `✓ Accredited` badge can mean something. Absent across all 119
   records on 2026-08-17.
2. **A delete route for our test rows.** They are on a public URL with no public delete endpoint. With
   ETN-013's D1 (new dealers arrive published) they go live the moment a sweep sees them, and hiding
   them in Strapi is a one-time job that stays done because the sweep never republishes.

Production has **no Connect credentials at all** — only a staging pair exists. With
`CONNECT_SYNC_ENABLED` defaulting to false that is a dormant cache rather than a broken one, but
`/find-dealer` in production will list nothing until prod has its own credentials and a first sweep
has run.
