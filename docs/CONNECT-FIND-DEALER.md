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
| Enquiry `dealer` field | Strapi relation | `dealerExternalId` (Connect `submission_id`) |

Both Strapi endpoints still exist and still serve the same JSON. Nothing in this app calls them.
Reverting this change restores them as the source.

## Transport: a pull, not the webhook

Connect also offers an HMAC-signed push (`dealer.approved`, `company_information.updated`), but it
sends nothing until **their** ops set `NOBETTERTIME_SYNC_URL` and `NOBETTERTIME_SYNC_SECRET`, which
cannot be done from this side. The pull works today, needs no shared secret and no public
internet-facing receiver, and their own delivery contract retries on a 60/300/900 second backoff, so
their worst case is already slower than the 5 minute cache window here.

## Measured API behaviour (verified 2026-08-17 against staging)

- **`source=nobettertime` is required on every request.** Omit it and Connect does not 400 — it
  **302s to its own login page**, which then "succeeds" as HTML and fails to parse. This is also why
  `links.next` in the response is never followed: their pagination URLs drop the parameter.
- **`per_page` and `limit` are ignored.** The page size is fixed at 15 (`meta.per_page: 15` comes
  back regardless), so a full read is `ceil(total / 15)` sequential requests. Paginate with `page=N`
  and read `meta.last_page`.
- **There is no server-side status filter.** `?status=approved` returns
  `422 {"message":"Status filtering is not available"}`. Approval is filtered on our side.
- **A single registration can be read by id**: `GET /api/public/dealer-registrations/{submission_id}`
  returns the same tree, `404` for an unknown id. The enquiry controller uses this.
- No key at all returns `401`.

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
- `backend/src/api/dealer-enquiry` re-checks approval against Connect before storing anything, using
  the by-id read. A hidden form stops nobody from POSTing to a public endpoint directly.

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

The read is capped at 40 pages (~600 dealers) and logs a warning if Connect reports more, so a capped
read never looks like a complete one.

## Current state

Connect staging holds **3 registrations, all `status: pending`**, all test artifacts from our own
probing. No real dealer exists there and none has ever been approved. So with this change live on
staging, `/find-dealer` shows its "No accredited dealers listed yet" panel and no enquiry form is
reachable. That is correct behaviour, not a bug — the page is now an honest view of what Connect
holds.

The 163-dealer migration that would populate Connect was **cancelled by the client**, blocked on
Connect enforcing website uniqueness while 37 of our 161 dealers legitimately share a corporate
website across locations. Until that is resolved or the dealers are created in Connect some other
way, the directory stays empty.
