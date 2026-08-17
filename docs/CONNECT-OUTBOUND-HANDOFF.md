# Caravea Connect outbound: handoff

How to bring Connect's dealer information onto `/find-dealer`.

This is the **outbound** direction only (Connect calls us). The inbound direction is built and running.
The 163-dealer migration into Connect is **cancelled**, not pending, so do not plan around it.

Read `docs/nobettertime-staging-connect.md` for the wire contract first. This document covers the
things that contract does not tell you, all of which were found by probing the live endpoint or
reading our own code.

---

## Where things stand

| Piece | State |
| --- | --- |
| Inbound (form submission to Connect) | Built, merged, **live on staging** since 2026-08-17 |
| Outbound (Connect to `/find-dealer`) | **Nothing built.** This document |
| Backfill of existing dealers | Script exists, deliberately never run. Migration cancelled |
| Connect's own outbound sender | **Dormant on their staging and production** |

Connect staging holds 3 records, all test artifacts from our own probing. No real dealer exists there,
and nothing has ever been approved, so no outbound event could have fired even if it were wired up.

### The dependency that gates half of this

Connect sends nothing until **their** ops set both:

```
NOBETTERTIME_SYNC_URL=https://staging.nobettertime.com.au/api/connect/sync
NOBETTERTIME_SYNC_SECRET=<a secret we generate and hand over>
```

Until that happens a push receiver cannot be tested against the real sender. A pull works today.

---

## Pick a transport

| | Pull (we poll their GET) | Push (they POST to us) |
| --- | --- | --- |
| Works today | Yes | No, blocked on their ops |
| Freshness | Bounded by the revalidate window | Immediate |
| Auth to build | Reuse the existing `X-Caravea-Key` | New HMAC verifier plus a shared secret |
| New attack surface | None | A public unauthenticated internet-facing endpoint |

**Recommendation: build the pull first and ship it.** Their events (`dealer.approved`,
`company_information.updated`) are low-frequency human admin actions, and their own delivery contract
retries on a 60/300/**900** second backoff, so their worst-case delivery is already slower than a
five-minute poll. Add the receiver later if someone complains about staleness, and build it then
against real traffic rather than a sample in a document.

If you build only the pull, you do not need the secret, the HMAC section, or the receiver at all.

---

## Where the code goes, and why not Strapi

- **Pull:** `frontend/src/lib/connect.ts`, server-only.
- **Receiver (later):** `frontend/src/app/api/connect/sync/route.ts`.

Both belong in Next, not Strapi, for two concrete reasons. Only a Next process can call
`revalidateTag`, so a Strapi receiver could not invalidate the cache it exists to invalidate. And
Strapi's `strapi::body` middleware consumes the request stream, so the raw bytes an HMAC is computed
over are already gone by the time a controller runs. In Next, `await req.text()` gives them to you.

Note this would be the **first Route Handler in the app**. There is no `frontend/src/app/api/**` today
and no local convention to copy. There is also no `middleware.ts` or `proxy.ts` (Next 16 renamed it),
so nothing intercepts the body.

Cost of putting it in Next: `CONNECT_API_KEY` is needed in `frontend/.env` as well as
`backend/.env`. It must **never** get a `NEXT_PUBLIC_` prefix or it ships to the browser.

---

## The hard problem: there is no match key

You have to join a Connect company to one of our `DirectoryDealer` rows, and **the obvious key does not
exist on either side**:

- `abn` is deliberately absent from `PUBLIC_DEALER_FIELDS` in
  `backend/src/api/dealer-submission/dto/public-dealer.ts`, so it is not in `DirectoryDealer`.
- Connect's read shape does not expose it either. `abn` appears only in the inbound POST body and the
  outbound webhook body, neither of which is what a pull reads.

Workable keys, in order:

1. `company.domain` against the registrable domain of our `website`.
2. Normalised `dealershipName` plus `postcode`.

Both are lossy, and there is a known collision: **19 corporate domains are shared by 56 of our
dealers** (MDC has 9 locations on one site, SUV Caravans 5, Lawrence RV 4, RV World 4, JB 4, Apollo 3).
Domain matching alone will therefore hit multiple candidates constantly.

**Rule: on more than one candidate, skip the overlay for that dealer.** A wrong match puts one
dealer's phone number on another's card, which is worse than showing slightly staler data.

Before wiring anything to the UI, **measure the match rate** and log the misses. If it is poor, the
honest answer may be that outbound is not worth building until Connect can return a stable identifier
we also store.

---

## Five hazards, each already paid for once

**1. Coordinates are ours. Never let Connect touch them.**
Connect returns `location.latitude` and `longitude` as null on read, and production Strapi has no
coordinate columns at all. The 157 pins on `/find-dealer` exist only because they were geocoded into
`staging`. An overlay that copies nulls over them silently empties the map. Exclude
`latitude`, `longitude` and `precision` from the merge entirely rather than guarding them per-field.

**2. `open_hours` arrives as HTML.**
Their sample is `"<p>Monday: 8:30–17:00</p>"`. Rendering it is stored XSS. Our own `tradingHours` is
structured JSON that `todayHoursLabel` in `frontend/src/lib/dealers.ts` already formats. Do not accept
their HTML field at all.

**3. Everything on `DirectoryDealer` reaches the browser.**
`DealerDirectory.tsx` is `"use client"` and `page.tsx` passes it the whole dealer array, so every field
is serialised into the RSC payload. Connect's list response includes `owner_email`. The merge needs its
own **explicit output allow-list** mirroring `toPublicDealer`, not a "copy non-null values" loop.
Decide deliberately whether `caravea_company_id` belongs in public HTML; keep it server-side unless
there is a reason.

**4. Overlaying array fields changes filtering, not just display.**
`brands`, `services`, `productTypes`, `state` and `tradingHours` all feed logic, not text:
`deriveFilterOptions` builds the dropdowns from them, `applyFilters` matches on them, and
`CHIP_PREDICATES` drives the Sales/Service/Rentals/Off-Road/Open Now chips. Existing `?brand=` deep
links can go dead. Worse, the state tiles come from `getDealerStateCounts()`, a **separate Strapi
endpoint the overlay never touches**, so overlaying `state` makes the counts contradict the list they
link to.
Safest first version: overlay only inert display fields (`description`, `phone`, `website`, `logo`).

**5. Media must go through the trusted-host check.**
`isTrustedMediaUrl` now lives at `backend/src/utils/trusted-media-url.ts`. It pins scheme, exact host,
bucket and root path, because the DigitalOcean regional endpoint is shared multi-tenant. Any
`logo_url` or `photo_urls` from Connect must pass it before reaching an `<img src>`. There is no
frontend copy of this helper yet, so port it or read it as the reference.

---

## Next.js 16 specifics that will bite

- **`revalidateTag` takes a required second argument in Next 16.** `revalidateTag("connect-dealers")`
  fails the build with TS2554. Use `revalidateTag("connect-dealers", { expire: 0 })`, the documented
  webhook idiom. Do not "modernise" to `updateTag`: it throws by construction inside a Route Handler.
- **`/find-dealer` is fully dynamic**, not ISR. It awaits `searchParams`, so it is absent from
  `prerender-manifest.json`. Caching therefore comes from the **explicit `next: { revalidate }` on the
  fetch**, not from the route being a server component. Anyone who later adds `cache: 'no-store'` or
  `dynamic = 'force-dynamic'` turns this into one upstream call per visitor with no test failing.
  Leave a comment in `connect.ts` saying so.
- **Verify caching against `npm run build && npm start`, never `next dev`.** Dev applies a different
  fetch cache and will give a false reading either way.
- **`server-only` is not installed.** Adding it as a devDependency and importing it at the top of
  `connect.ts` turns an accidental client import into a build error instead of a leaked API key.
- Give the pull a per-request timeout and a total page budget. At 15 records per page a full read is
  around 11 sequential requests, and the staging deploy script wipes `.next/cache/fetch-cache`, so the
  first visitor after every deploy pays all of them.
- **Do not follow `links.next` for pagination.** Their sample pagination URLs drop the required
  `source=nobettertime`. Build page URLs yourself.

---

## If you do build the receiver

Algorithm, straight from their contract:

```
signature = HMAC-SHA256(X-Caravea-Timestamp + "\n" + raw-request-body, NOBETTERTIME_SYNC_SECRET)
header    = "X-Caravea-Signature: sha256=" + lowercase-hex
```

- Read `await req.text()` **before** any parsing, and sign those exact bytes. Their sample body in the
  contract is pretty-printed while they transmit compact JSON, so a signature over the document will
  never match.
- Sign the timestamp header **verbatim**. Never re-serialise it through a `Date`.
- Validate the header shape (`sha256=` plus 64 lowercase hex) before decoding, and compare decoded
  32-byte buffers with `crypto.timingSafeEqual`. It **throws on a length mismatch**, so length-check
  first.
- **Ask Connect whether they re-sign per retry attempt.** Their queue backs off 60, 300 then 900
  seconds. If they sign once at enqueue, a ±300s acceptance window permanently rejects the final
  retry, which is the attempt that most needs to succeed. Get the answer before choosing the window.
- **Fail closed.** Note this is deliberately the opposite of `verify-recaptcha.ts`, which fails open.
  Different threat models: a reCAPTCHA failure would destroy a known legitimate dealer's submission,
  whereas an unverifiable signature means an anonymous caller we cannot identify.
- Cap the body size before reading, and rate-limit per IP. Every other public endpoint here does
  (`dealer-enquiry`, `geocode`); this would otherwise be the only one that does not.
- Replay inside the window is acceptable **only** while the handler is a pure cache invalidation with
  no persistence. If it ever writes, add a nonce or dedupe on `event` plus `occurred_at`.
- Decide what an unconfigured secret returns. `503` is the one status they retry, so setting their URL
  before our secret exists would generate six attempts plus a logged warning per event. A quiet `200`
  or a `404` is friendlier.

---

## Reuse rather than rewrite

| Need | Already exists |
| --- | --- |
| Trusted media host check | `backend/src/utils/trusted-media-url.ts` |
| Outbound HTTP client shape (typed result, timeout, never throws) | `backend/src/utils/connect-client.ts` |
| Dealer read + type | `getDealers()` and `DirectoryDealer` in `frontend/src/lib/strapi.ts` |
| Error-code to message mapping | `frontend/src/lib/formErrors.ts` |
| Distance, open-now, filter predicates | `frontend/src/lib/dealers.ts` |

---

## Questions for Connect before starting

1. Is there a stable dealer identifier we can store and match on, given ABN is not exposed on the read
   side? Without one, matching is fuzzy by construction.
2. Do you re-sign each retry attempt, or sign once at enqueue?
3. Will `location.latitude` / `longitude` ever be populated on the read side, or are we always the
   source of truth for coordinates?
4. Can `open_hours` be returned as structured data instead of an HTML string?
5. **Will the website-uniqueness rule be relaxed?** It is the reason the migration was cancelled: 37 of
   our 161 dealers are separate dealerships that legitimately share a corporate website.

---

## Definition of done

- Match rate measured and logged, with an explicit skip on ambiguity.
- Output allow-list in place; `owner_email` provably absent from the page payload.
- Coordinates provably unchanged: 157 pins before and after.
- `/find-dealer` renders identically when `CONNECT_API_KEY` is unset.
- Filter dropdowns, chips and state-tile counts still agree with the list.
- Cache verified against a production build: one upstream call per window, not per visitor.
- `npm run build:backend` and `npm run lint` green.
