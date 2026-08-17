# /find-dealer reads from Caravea Connect

`/find-dealer` no longer lists dealers from Strapi. It pulls them from the Caravea Connect
dealer-registrations API. This is the OUTBOUND direction (Connect to us); the inbound direction
(a dealer onboarding submission forwarded to Connect) is a separate, already-shipped path and is
untouched by this.

**Both directions are dormant until `CONNECT_API_URL` and `CONNECT_API_KEY` are set on the server.**
Without them `/find-dealer` renders its "can't load the dealer directory" panel. There is no Strapi
fallback any more.

## What changed

| | Before | Now |
| --- | --- | --- |
| Dealer list | Strapi `GET /api/dealers` | Connect `GET /api/public/dealer-registrations` |
| State tile counts | Strapi `GET /api/dealer-counts` | Derived from the same list the page renders |
| Enquiry form | Always rendered | Only for dealers Connect has **approved** |
| Enquiry `dealer` field | Strapi relation | `dealerExternalId` (Connect `reference`) |

Both Strapi endpoints still exist and still serve the same JSON. Nothing in this app calls them.
Reverting this change restores them as the source.

## Transport: a pull, not the webhook

Connect also offers an HMAC-signed push (`dealer.approved`, `company_information.updated`), but it
sends nothing until **their** ops set `NOBETTERTIME_SYNC_URL` and `NOBETTERTIME_SYNC_SECRET`, which
cannot be done from this side. The pull works today, needs no shared secret and no public
internet-facing receiver, and their own delivery contract retries on a 60/300/900 second backoff, so
their worst case is already slower than the 5 minute cache window here.

## Measured API behaviour (re-verified 2026-08-17 against staging, after Connect's v2 redeploy)

- **`source=nobettertime` is required on every request.** Omit it and Connect does not 400 — it
  **302s to its own login page**, which then "succeeds" as HTML and fails to parse. This is also why
  `links.next` in the response is never followed: their pagination URLs drop the parameter.
- **`per_page` is honoured, and the parameter name is load-bearing.** Default 10, maximum 100
  (`per_page=200` → `422 {"message":"The per page field must not be greater than 100."}`). `limit`,
  `page_size` and `pageSize` are still **ignored** and fall through to the default 10. We send
  `per_page=100`, which reads the current 119 registrations in 2 requests instead of 12. Paginate
  with `page=N` and read `meta.last_page`.
- **There is no server-side status filter.** `?status=approved` returns
  `422 {"message":"Status filtering is not available"}`. Approval is filtered on our side. There is
  no `?reference=` filter either — it is ignored and the full list comes back.
- **The by-id read still exists but the list can no longer reach it.**
  `GET /api/public/dealer-registrations/{submission_id}` works and returns the OLD nested tree, but
  it only accepts the ULID `submission_id`, which the list stopped emitting (see below).
  `caravea_company_id` / `reference` **404** there, raw and URL-encoded. This is why
  `connect-lookup.ts` has a list-scan fallback.
- No key at all returns `401`.

## The v2 list shape, and why both shapes are read

On 2026-08-17 Connect redeployed the list endpoint. Three things changed together, and the third was
breaking and unannounced:

1. `per_page` started working (above).
2. The dealer CSV import landed: **3 records became 119** (116 real dealers plus 3 of our own test
   rows). 113 carry coordinates.
3. **The response shape flattened and `submission_id` disappeared.** The `data[].company.*` wrapper
   collapsed up one level:

```
OLD  data[] = { submission_id, source, status, submitted_at, processed_at,
                company: { reference, caravea_company_id, status, approved_at, …,
                           company:{…profile}, location:{…}, information:{…} } }

NEW  data[] = { reference, caravea_company_id, source, status, submitted_at,
                approved_at, rejected_at, rejection_reason,
                company:{…profile}, location:{…}, information:{…} }
```

That change rendered **zero of the 119 dealers** and nothing errored: the mapper read
`record.submission_id` and `record.company.company`, both absent, so every record mapped to `null`
and the page showed its "no dealers listed yet" empty state.

Both readers now normalise before mapping (`normaliseRecord` in `frontend/src/lib/connect.ts`,
`normalise` in `backend/src/utils/connect-lookup.ts`). The tell is `company.company`: an object there
means the old wrapper is still present. **Both shapes have to be supported at once**, because the
list returns the new one while the by-id show endpoint still returns the old one.

The id the directory keys cards, pins and the enquiry POST on is now `reference`
(`caraveacomp|Vrpb3uPIK2QxIgYyeHWA`), falling back to `caravea_company_id`. `submission_id` is still
preferred when present, because it is the only id the cheap by-id lookup accepts.

### The guard that would have caught it

`getConnectDealers` now **throws when Connect returns records and none of them map**. That routes the
page to its outage panel and logs a line, instead of quietly claiming the directory is empty. A single
unmappable record is still skipped silently, as before — only a total wipeout trips it.

This closes a real gap: the `null`-vs-`[]` split was designed to tell an outage from an empty
directory, and a shape change is exactly the case it could not tell apart.

## Field mapping notes

`frontend/src/lib/connect.ts` builds each `DirectoryDealer` by explicit assignment and never spreads
a Connect record. That matters: `DealerDirectory` is a client island and the page hands it the whole
array, so **every mapped field is serialised into the RSC payload and reaches the browser**. Connect's
response contains `owner_email`, `abn`, `legal_name`, `leads_email`, `sms_number`, the submitter
contact block, licence numbers and the consent flags. None of them are mapped.

Three traps worth keeping in mind if the mapping is extended:

1. **`company.open_hours` is rendered HTML** (`"<p>Monday: 8:30-17:00</p>"`). It is never read.
   Putting Connect-authored HTML on the page would be stored XSS. The structured
   `information.trading_hours` is used instead, which is the shape `isOpenNow` already parses.
2. **Coordinates come back as decimal STRINGS** (`"-37.82530000"`), so a `typeof x === "number"`
   guard silently drops every pin. They are parsed. Connect stores no precision field, so every
   Connect coordinate is treated as approximate and keeps its `~` in distance labels; a dealer with
   no coordinate falls back to their postcode centroid, as before.
3. **Media URLs are free-text strings that go straight into `<img src>`.** They are pinned to host +
   bucket + root path via `DO_SPACE_BUCKET` / `DO_SPACE_ROOT_PATH`, because
   `syd1.digitaloceanspaces.com` is DigitalOcean's shared regional endpoint — host alone would let
   any Spaces customer choose the images on our directory. If either var is unset, every dealer image
   is rejected. That is deliberate: a visible failure beats a silent widening.

## The approval gate

`DirectoryDealer.approved` decides whether the enquiry form renders. An unapproved dealer still
appears in the list, on the map, and in their own modal with address, hours, services, brands,
directions and website — they simply cannot be sent a lead.

Connect is adding an explicit approval boolean to the payload. It is not on the read shape yet, so
both readers check for it first (under `approved` / `is_approved` / `isApproved`) and otherwise fall
back to `company.status === "approved"` and then `company.approved_at`. **Unrecognisable state reads
as not approved.** When the real field ships, confirm its name and drop the fallbacks.

The gate is enforced in two places, and the frontend one is not the important one:

- `DealerModal` hides the form. Presentation only.
- `backend/src/api/dealer-enquiry` re-checks approval against Connect before storing anything. A
  hidden form stops nobody from POSTing to a public endpoint directly.

`connect-lookup.ts` resolves the dealer by whichever id arrived, and the route is picked by format —
a `reference` contains a `|`, which no ULID does:

| Id on the enquiry | Route | Cost |
| --- | --- | --- |
| `reference` / `caravea_company_id` (today) | paginated list scan, matched on either id | 1–2 requests |
| `submission_id` (page cached before the redeploy) | by-id show endpoint, list scan only if it 404s | 1 request |

The scan is bounded at 20 pages, and a scan that hits that cap returns `connect-unavailable` rather
than `dealer-not-found` — telling a visitor their dealer does not exist when we merely stopped
looking would be a lie. The scan is only reachable from `create`, which runs its per-IP rate limit
(5 per 15 minutes) *before* resolving a dealer; that limit is what stops this becoming an
unauthenticated way to generate Connect traffic.

The controller also takes the dealership name from Connect's response, never from the request body —
it is denormalised onto the stored enquiry, so a client-settable name would let anyone write whatever
they liked into an admin's view of who an enquiry was for. Every failure path denies: unknown id,
unapproved dealer, and an unreachable Connect all refuse the write rather than store a lead against a
dealer whose standing could not be confirmed.

## Caching

`/find-dealer` awaits `searchParams`, so it is fully dynamic and gets no ISR of its own. The only
thing making it cheap is the explicit `next: { revalidate: 300, tags: ["connect-dealers"] }` on the
Connect fetch. **Adding `cache: "no-store"` there would silently turn this into a full Connect read
per visitor, and no test would fail.**

Verify caching against `npm run build && npm start`, never `next dev` — dev uses a different fetch
cache and gives a false reading either way. Note also that the staging deploy script wipes
`.next/cache/fetch-cache`, so the first visitor after every deploy pays the whole read.

The read is capped at 20 pages (2,000 dealers at `per_page=100`) and logs a warning if Connect reports
more, so a capped read never looks like a complete one.

## Current state

Connect staging holds **119 registrations**: 116 real dealers from the CSV import, plus 3 test rows
of our own (`ZZZ QA Test 1786927671`, `ZZZ Mapper Probe (delete me)`, `Raf 8 (Camarin)`). 113 carry
coordinates. By state: QLD 45, NSW 36, VIC 23, SA 7, WA 5, ACT 2, NT 1.

**Every one of them is `status: pending` and none has ever been approved**, so the directory lists
and maps all 119 while **no enquiry form is reachable anywhere**. That is the approval gate working,
not a bug.

Two things are still owed by Connect:

1. **An approval field.** Re-checked across all 119 records on 2026-08-17 — no `approved` /
   `is_approved` / `isApproved` at any key path, `approved_at` null everywhere, `status` `pending`
   everywhere. Until dealers are approved there, the enquiry form stays hidden.
2. **A delete route for our 3 test rows.** They are on a public URL and there is no public delete
   endpoint.

The 163-dealer migration referenced in earlier revisions of this doc is **done** — that is what the
119 are. It went as a CSV for Connect's team to import, after the API backfill was abandoned over
Connect enforcing website uniqueness while 37 of our dealers legitimately share a corporate website
across locations.
