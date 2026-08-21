# Dealer payloads (JSON)

The public dealer payloads, as they exist on `staging`: what the two forms POST in, and what the
`/find-dealer` directory reads back out.

| Payload | Page | Endpoint | Collection |
| --- | --- | --- | --- |
| Dealer onboarding (write) | `/dealer-directory-onboarding` | `POST /api/dealer-submissions` | `dealer-submission` |
| Consumer enquiry (write) | `/find-dealer` (dealer modal) | `POST /api/dealer-enquiries` | `dealer-enquiry` |
| Directory profile (read) | ~~`/find-dealer`~~ (no longer read by the site) | `GET /api/dealers` | `dealer-submission` |

Base URLs: staging `https://staging-cms.nobettertime.com.au`, production
`https://cms.nobettertime.com.au`.

> **`/find-dealer` no longer reads `GET /api/dealers`.** The directory is pulled from Caravea Connect
> instead, so the "Directory profile (read)" payload below documents an endpoint that still exists and
> still serves the same JSON, but which nothing on the site calls. See `docs/CONNECT-FIND-DEALER.md`.

Both routes are public (`auth: false`), take a JSON body wrapped in `data`, and answer with
`{"ok": true}` only. Neither ever echoes the stored record back.

Sources: `frontend/src/components/DealerOnboardingForm/DealerOnboardingForm.tsx`,
`frontend/src/components/DealerDirectory/DealerEnquiryForm.tsx`, and the matching controllers
under `backend/src/api/*/controllers/`.

---

## 1. Dealer onboarding: `POST /api/dealer-submissions`

Built in `DealerOnboardingForm.tsx` (the `const data = { ... }` block in `handleSubmit`).

```json
{
  "data": {
    "dealershipName": "Aussie Caravan Centre",
    "legalName": "Aussie Caravan Centre Pty Ltd",
    "abn": "12345678901",
    "established": 1998,
    "dms": "Other",
    "dmsOther": "In-house system",

    "street": "42 Princes Highway",
    "suburb": "Dandenong",
    "state": "VIC",
    "postcode": "3175",

    "motorDealerLicenceName": "",
    "motorDealerLicenceNumber": "",

    "phone": "03 9700 0000",
    "leadsEmail": "leads@aussiecaravan.com.au",
    "smsNumber": "0400 000 000",
    "contactName": "Jane Smith",
    "contactRole": "Dealer Principal",
    "enquiriesEmail": "enquiries@aussiecaravan.com.au",

    "servicesOther": "",
    "brandsOther": "",
    "productsOther": "",

    "website": "https://aussiecaravan.com.au",
    "description": "Family-run caravan dealership serving Melbourne's south-east since 1998.",

    "facebook": "https://facebook.com/aussiecaravan",
    "instagram": "https://instagram.com/aussiecaravan",
    "youtube": "",
    "googleProfile": "https://g.page/aussiecaravan",

    "submitterName": "Jane Smith",
    "submitterEmail": "jane@aussiecaravan.com.au",
    "submitterPhone": "0400 000 000",
    "stateAssociation": "CIVIC",

    "multipleLocations": false,
    "financeAvailable": true,
    "deliveryAvailable": true,
    "rvmapBadged": false,
    "rvmasterBadged": false,
    "authorised": true,
    "privacyConsent": true,
    "marketingConsent": true,

    "stockCondition": "Both",
    "services": ["New sales", "Used sales", "Servicing", "Spare parts"],
    "brands": ["Jayco", "New Age", "Snowy River"],
    "productTypes": ["Full-size touring", "Off-road", "Family / bunk"],

    "tradingHours": {
      "Monday":    { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Tuesday":   { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Wednesday": { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Thursday":  { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Friday":    { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Saturday":  { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
      "Sunday":    { "open": false, "openTime": "09:00", "closeTime": "17:00" }
    },

    "logo": "https://<space>.<region>.digitaloceanspaces.com/nobettertime/logo_abc123.webp",
    "photos": [
      "https://<space>.<region>.digitaloceanspaces.com/nobettertime/yard_1_abc.webp",
      "https://<space>.<region>.digitaloceanspaces.com/nobettertime/yard_2_def.webp"
    ],
    "mediaErrors": [
      {
        "field": "photos",
        "name": "showroom.jpg",
        "size": 0,
        "type": "image/jpeg",
        "status": null,
        "message": "File is empty (0 bytes)"
      }
    ],

    "submittedAt": "2026-08-14T02:31:07.412Z",

    "pin": {
      "lat": -37.9871,
      "lng": 145.2149,
      "precision": "street",
      "source": "geocoded",
      "matchedAddress": "42, Princes Highway, Dandenong, City of Greater Dandenong, Victoria, 3175, Australia",
      "geocodedAddress": "42 Princes Highway, Dandenong VIC 3175"
    },

    "comment": "",
    "elapsedMs": 184320,
    "recaptchaToken": "03AGdBq26...."
  }
}
```

### Field notes

- **Scalars are strings.** `established` is the one exception: sent as a number, or `null` when
  blank. The booleans listed above (`multipleLocations` through `marketingConsent`) are real
  booleans.
- **`state`** is an enum: `VIC`, `NSW`, `QLD`, `SA`, `WA`, `TAS`, `NT`, `ACT`.
  `stockCondition` is `New` | `Used` | `Both`.
- **`motorDealerLicenceName` / `motorDealerLicenceNumber`** are only required when `state` is
  `NSW`, but the keys are always sent.
- **`tradingHours`** always carries all seven day keys, each `{ open, openTime, closeTime }`.
  Default is Monday to Saturday 09:00-17:00, Sunday closed.
- **`services` / `brands` / `productTypes`** are string arrays drawn from
  `frontend/src/components/DealerOnboardingForm/options.ts`. Free-text extras ride along in the
  matching `*Other` string fields.
- **`logo` and `photos` are URL strings, not media relations.** Files upload first, one per
  request, as multipart `files` to `POST /api/upload`; only the returned URLs go into this
  payload. Anything that failed to upload is described in `mediaErrors` and the submission still
  saves.

### Server-owned keys: never send these

`latitude`, `longitude`, `precision`, `geocodeSource`, `matchedAddress`, `geocodedAddress`.

They are real schema attributes, so Strapi would happily persist whatever arrived in them, and
this create is public and unauthenticated. The controller strips all six from client input and
writes only what `validateDealerPin(pin, postcode)` returns. Send the nested **`pin`** object
instead, and **omit `pin` entirely** (do not send nulls) when the address never resolved.

### Transient keys

`recaptchaToken`, `verifyOnly`, `comment`, `elapsedMs`, `pin` are stripped before the DB write.
Any *other* unrecognised root key is a hard **400**, not a silent drop: Strapi's `validateInput`
runs `throwUnrecognizedFields` unconditionally.

### Pre-check call

The form verifies the reCAPTCHA token before uploading any photos, so a dealer on a network that
blocks Google finds out in about a second instead of after a multi-minute upload:

```json
{ "data": { "verifyOnly": true, "recaptchaToken": "03AGdBq26...." } }
```

Response is `{"ok": true}`. Note that v3 tokens are single-use, so the real submit mints a fresh
one (reusing the pre-check token returns `timeout-or-duplicate`).

### Spam signals

`comment` is a honeypot (hidden field, only bots fill it) and `elapsedMs` under 3000 is
"too fast". Neither rejects the submission: both just set `spamSuspect: true` and log a warning.

---

## 2. Consumer enquiry: `POST /api/dealer-enquiries`

Built in `DealerEnquiryForm.tsx`. This is the `/find-dealer` enquiry, a different form from the
onboarding page above.

```json
{
  "data": {
    "dealer": "abc123documentid",
    "name": "Chris Hayag",
    "email": "chris@example.com",
    "phone": "0400 000 000",
    "postcode": "3175",
    "interest": "Off-road caravans",
    "message": "Hi, I'm after a family bunk van under $90k. What have you got in stock?",

    "comment": "",
    "elapsedMs": 42311,
    "recaptchaToken": "03AGdBq26...."
  }
}
```

### Field notes

- **`dealer`** is normally Caravea Connect's **`submission_id`**, since that is what `/find-dealer`
  now lists dealers by. A dealer-submission `documentId` still resolves too (it is tried first), for
  enquiries sent from a page cached before the switch. Failure codes:
  `dealer-not-found` (neither source knows the id), `dealer-not-approved` (Connect holds the dealer
  but has not approved them, so they take no enquiries), `connect-unavailable` (Connect could not be
  reached, or this environment has no `CONNECT_API_URL`/`CONNECT_API_KEY`, so approval could not be
  confirmed). All three refuse the write.
- **Required:** `name`, `email`, `message`. **Optional:** `phone`, `postcode`, `interest`.
- **Max lengths** (enforced server-side by truncation, not rejection): name 120, email 180,
  phone 40, postcode 8, interest 160, message 2000.
- CR/LF is stripped from every single-line field as a header-injection defence.

### Server-added fields

`dealerName` (denormalised from whichever source resolved the dealer, the local row or Connect's own
response, never from the request body), `dealerExternalId` (the Connect `submission_id`, set instead
of the `dealer` relation when the dealer came from Connect), `ipHash`, `submittedAt`, `sourcePage`
(`"/find-dealer"`), `spamSuspect`. Client-sent values for these are ignored.

### Rate limits

Keyed on hashed IP, because reCAPTCHA verification deliberately fails open when unconfigured or
unreachable:

- 5 enquiries per IP per 15 minutes
- 2 enquiries per IP per dealer per hour

Both return **429** with `code: "rate-limited"`.

### Reading enquiries back

You cannot, over the public API. `routes/dealer-enquiry.ts` deliberately declares only the one
`create` route rather than using `createCoreRouter`, because this collection holds consumer PII.
`find` / `findOne` do not exist. Reading enquiries means the Strapi admin or an API token.

---

## 3. Find-a-dealer profile entry: `GET /api/dealers`

The directory profile is **not a separate collection or a separate write**. It is the sanitised,
public projection of a `dealer-submission` row, built by allow-list in
`backend/src/api/dealer-submission/dto/public-dealer.ts` and served by the `findPublic` action.
So the way to create a profile entry is the onboarding payload in section 1 (or a row created in
the Strapi admin); this section is the shape that comes back out.

Response envelope, all dealers in one call (no pagination), sorted by `state` then
`dealershipName`:

```json
{
  "data": [ /* dealer objects, shape below */ ],
  "meta": { "total": 147 }
}
```

A single entry, keys in exactly the order the API returns them:

```json
{
  "documentId": "abc123documentid",
  "dealershipName": "Aussie Caravan Centre",
  "street": "42 Princes Highway",
  "suburb": "Dandenong",
  "state": "VIC",
  "postcode": "3175",
  "phone": "03 9700 0000",
  "website": "https://aussiecaravan.com.au",
  "description": "Family-run caravan dealership serving Melbourne's south-east since 1998.",
  "logo": "https://<space>.<region>.digitaloceanspaces.com/nobettertime/logo_abc123.webp",
  "photos": [
    "https://<space>.<region>.digitaloceanspaces.com/nobettertime/yard_1_abc.webp",
    "https://<space>.<region>.digitaloceanspaces.com/nobettertime/yard_2_def.webp"
  ],
  "facebook": "https://facebook.com/aussiecaravan",
  "instagram": "https://instagram.com/aussiecaravan",
  "youtube": null,
  "googleProfile": "https://g.page/aussiecaravan",
  "tradingHours": {
    "Monday":    { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Tuesday":   { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Wednesday": { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Thursday":  { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Friday":    { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Saturday":  { "open": true,  "openTime": "09:00", "closeTime": "17:00" },
    "Sunday":    { "open": false, "openTime": "09:00", "closeTime": "17:00" }
  },
  "services": ["New sales", "Used sales", "Servicing", "Spare parts"],
  "servicesOther": null,
  "brands": ["Jayco", "New Age", "Snowy River"],
  "brandsOther": null,
  "productTypes": ["Full-size touring", "Off-road", "Family / bunk"],
  "productsOther": null,
  "stockCondition": "Both",
  "financeAvailable": true,
  "deliveryAvailable": true,
  "rvmapBadged": false,
  "rvmasterBadged": false,
  "established": 1998,
  "multipleLocations": false,
  "stateAssociation": "CIVIC",
  "latitude": -37.9871,
  "longitude": 145.2149,
  "precision": "street"
}
```

That is the complete list: **33 fields, allow-listed**. `PUBLIC_DEALER_FIELDS` is both the SQL
`select` and the output allow-list, so nothing outside it ever leaves SQLite. A field added to the
schema later is invisible here until someone adds it to that array by hand, which is the point.

Frontend contract for the same shape: `DirectoryDealer` in `frontend/src/lib/strapi.ts`.

### What is deliberately NOT in a profile entry

ABN, legal name, licence name and number, DMS, `leadsEmail`, `enquiriesEmail`, `smsNumber`,
`contactName`, `contactRole`, every `submitter*` field, the consent flags, `mediaErrors`,
`submittedAt`, `spamSuspect`, and the three private coordinate fields (`geocodeSource`,
`matchedAddress`, `geocodedAddress`).

### Nulls, media and coordinates

- **Every absent value is an explicit `null`**, never a missing key (`row[field] ?? null`). The
  frontend depends on the shape being identical for every dealer. Exception: `photos` is `[]`.
- **`logo` and `photos` are plain URL strings, not Strapi media relations.** Do not run them
  through `strapiMedia()`. Each URL is validated against the DigitalOcean Spaces host **and** the
  bucket + root path prefix; anything else is dropped (`logo` becomes `null`, bad entries are
  filtered out of `photos`). The regional Spaces host is shared multi-tenant, so the host check
  alone is not enough.
- **`latitude` / `longitude` / `precision` may be null.** The map then falls back to the postcode
  centroid from `frontend/src/lib/au-postcode-centroids.json`, and `precision` other than
  `"street"` keeps the `~` on distance labels.

### Which rows appear

Only the non-spam gate: `spamSuspect` is `false` **or** `null`. `spamSuspect` is NULL for most
genuine dealers (the heuristics never fired), so a plain `{ spamSuspect: false }` filter would
hide them; use `DEALER_NOT_SPAM_FILTER`.

There is **no publication gate on this endpoint**: any dealer-submission row that is not spam-flagged
is returned as soon as it is written, subject to the cache below. That used to mean it went straight
onto `/find-dealer`; it no longer does, because the page reads Connect instead, and Connect's own
approval state now decides whether a dealer can be sent an enquiry.

### Caching

`Cache-Control: public, max-age=60, stale-while-revalidate=300` on `/api/dealers`, and
`max-age=300` on `/api/dealer-counts`, on top of the page's own ISR window. An admin edit is not
instant on the live page.

### Companion endpoint: `GET /api/dealer-counts`

Feeds the state filter UI.

```json
{ "data": { "VIC": 28, "NSW": 46, "QLD": 31 }, "meta": { "total": 147 } }
```

Rows with a null `state` are counted in neither `data` nor `meta.total`.

---

## 4. Caravea Connect (outbound): `POST {CONNECT_API_URL}/api/public/dealer-registrations`

Not a form the dealer sees. Every accepted dealer-submission create is best-effort forwarded to
Caravea Connect's inbound endpoint from `afterCreate` in
`backend/src/api/dealer-submission/content-types/dealer-submission/lifecycles.ts`, in its own
try/catch placed *before* the SMTP notification block (which returns early on every environment
without SMTP configured).

- Mapper: `backend/src/utils/connect-registration.ts` — `toConnectRegistration()`,
  `shouldPushToConnect()`. Pure, no Strapi imports, no env reads, safe to import from the lifecycle
  and from the (later) backfill script alike.
- Client: `backend/src/utils/connect-client.ts` — `isConnectEnabled()`, `postDealerRegistration()`.
  5s timeout (`AbortSignal.timeout`), **no retry**: `afterCreate` runs inside the create's DB write
  transaction, so a slow/dead Connect must never hold a dealer's submit request open longer than it
  already can be. A miss is covered by a separate re-push, not an automatic retry.
- Dormant unless **both** `CONNECT_API_URL` and `CONNECT_API_KEY` are set (see `backend/.env.example`
  / `docs/deploy/env.backend.template`). A dealer submission still saves normally either way.

### Push eligibility (`shouldPushToConnect`)

A row is pushed only when all three hold, otherwise it is skipped and the reason is logged at `warn`
with the `documentId` (never re-thrown, never blocks the submission):

- `spamSuspect !== true` (NULL and `false` both count as not spam).
- `logo` is present and survives URL validation — confirmed live against Connect staging: an absent
  `logo` 422s with "The logo field is required."
- `photos` has at least one entry that survives URL validation — also confirmed live: an empty
  `photos: []` 422s the same way as omitting the key entirely.

Rows that fail either media check are **skipped, never sent with an invented placeholder** image.

### Field mapping notes

Full contract: `docs/nobettertime-staging-connect.md`.

- `geocodeSource` is always the constant `"nobettertime"` — it names the *sending system* to
  Connect, not our own `geocoded|adjusted|imported|admin` provenance column (sending ours verbatim
  would ship `"imported"` for 88% of dealers).
- `latitude` / `longitude` / `geocodePrecision` are omitted entirely when the dealer has no pin,
  guarded on `Number.isFinite` of the raw value (not truthiness, and not a coerced `Number()`) — a
  longitude of `0` is a real value and `Number('')` is `0`.
- `geocodedAddress` is omitted when empty/absent (it's `private: true`, so the backfill path can
  never see it at all).
- `website`, `facebook`, `instagram`, `youtube`, `googleProfile`, `logo`, each `photos` entry: run
  through one URL normaliser (scheme added only if missing, validated via `new URL()`, hostname must
  contain a dot) or become `null` / dropped on any failure.
- `abn` has whitespace stripped (no other reformatting). `established` outside `1800..currentYear`
  becomes `null`.
- `services` / `brands` / `productTypes` are forwarded as-is — no de-duplication (measured: zero
  exact duplicates in the real data, and a fuzzy rule would drop legitimate distinct brand options).
- `comment` and `elapsedMs` are always `null` (neither is a column on this collection).
- `mediaErrors`, `recaptchaToken`, `pin`, `spamSuspect`, `documentId`, `id`, and every other Strapi
  internal are never forwarded — the payload is built by explicit assignment, never by spreading the
  row.

### Logging discipline

Only `documentId`, HTTP status, an outcome word, and a duration are ever logged. Never a payload
field (ABN, submitter contact details, etc.), never the API key or any prefix of it, never Connect's
response body (its 422s echo submitted field names *and values*), and never a raw `fetch` rejection
object.

---

## Error handling (both endpoints)

Failures come back as a Strapi error with a stable `code` in `details`, so the form can show a
specific message instead of one generic sentence. Codes in use include `recaptcha-failed`,
`browser-error`, `timeout-or-duplicate`, `invalid-field` (with `field`), `dealer-not-found`,
and `rate-limited`. Frontend mapping lives in `frontend/src/lib/formErrors.ts`.
