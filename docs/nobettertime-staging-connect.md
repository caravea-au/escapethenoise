# NoBetterTime â†” Caravea Connect â€” staging access and sample test data

## Connection details

| Item | Value |
| --- | --- |
| Base URL | `https://staging-connect-v3.caravea.au` |
| Dealer registration endpoint | `https://staging-connect-v3.caravea.au/api/public/dealer-registrations` |
| Header | `X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>` |
| Required source | `nobettertime` |

## Which direction is which

Direction below is named from Caravea Connect's point of view, so the two never get confused mid-test.

| Direction | Who calls whom | Transport | Auth |
| --- | --- | --- | --- |
| **Inbound** | NoBetterTime calls Connect | `POST` and `GET` on `/api/public/dealer-registrations` | `X-Caravea-Key` shared key header |
| **Outbound** | Connect calls NoBetterTime | `POST` to `NOBETTERTIME_SYNC_URL` | `X-Caravea-Signature` HMAC-SHA256 |

The two directions use different credentials and are independently switchable.
Inbound works today on staging with the key above.
Outbound stays dormant until NoBetterTime supplies its endpoint URL and sync secret.

## Required API fields (inbound)

Every inbound request must send the shared `X-Caravea-Key` header and a source value:

```json
{
  "source": "nobettertime"
}
```

`source` is required for both POST and GET requests.
It is stored with the registration and scopes its read-back endpoints.

---

# INBOUND â€” NoBetterTime â†’ Connect

## 1. POST a dealer registration

### Request

```http
POST https://staging-connect-v3.caravea.au/api/public/dealer-registrations
X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>
Content-Type: application/json
Accept: application/json
```

### Complete POST payload

```json
{
  "source": "nobettertime",
  "dealershipName": "Outback Caravans Silverwater",
  "legalName": "Outback Caravans Pty Ltd",
  "abn": "51 824 753 556",
  "established": 1998,
  "dms": "Caravea Connect",
  "dmsOther": null,
  "street": "12 Silverwater Road",
  "suburb": "Silverwater",
  "state": "NSW",
  "postcode": "2128",
  "latitude": -33.8332,
  "longitude": 151.0431,
  "geocodePrecision": "street",
  "geocodeSource": "nobettertime",
  "geocodedAddress": "12 Silverwater Road, Silverwater NSW 2128",
  "motorDealerLicenceName": "Outback Caravans Pty Ltd",
  "motorDealerLicenceNumber": "MD-0491287",
  "phone": "(02) 9748 1122",
  "leadsEmail": "leads@outbackcaravans.com.au",
  "smsNumber": "+61 412 987 654",
  "contactName": "Dana Whitlock",
  "contactRole": "Dealer Principal",
  "enquiriesEmail": "enquiries@outbackcaravans.com.au",
  "services": ["New sales", "Used sales", "Servicing"],
  "servicesOther": "Annual gas & electrical compliance",
  "brands": ["Jayco", "New Age"],
  "brandsOther": null,
  "productTypes": ["Pop top", "Full-size touring", "Off-road"],
  "productsOther": null,
  "stockCondition": "Both",
  "website": "https://outbackcaravans.com.au",
  "description": "Family-owned caravan dealership serving Western Sydney.",
  "facebook": "https://facebook.com/outbackcaravans",
  "instagram": "https://instagram.com/outbackcaravans",
  "youtube": "https://youtube.com/@outbackcaravans",
  "googleProfile": "https://g.page/outback-caravans-silverwater",
  "tradingHours": {
    "Monday": { "open": true, "openTime": "08:30", "closeTime": "17:00" },
    "Sunday": { "open": false, "openTime": "", "closeTime": "" }
  },
  "logo": "https://syd1.digitaloceanspaces.com/media-caravea/nobettertime/dealers/outback/logo.png",
  "photos": [
    "https://syd1.digitaloceanspaces.com/media-caravea/nobettertime/dealers/outback/yard.png"
  ],
  "multipleLocations": true,
  "financeAvailable": true,
  "deliveryAvailable": true,
  "rvmapBadged": false,
  "rvmasterBadged": true,
  "submitterName": "Dana Whitlock",
  "submitterEmail": "dana@outbackcaravans.com.au",
  "submitterPhone": "+61 412 987 654",
  "stateAssociation": "Caravan & Camping Industry Association NSW",
  "authorised": true,
  "privacyConsent": true,
  "marketingConsent": false,
  "submittedAt": "2026-08-15T02:14:31.482Z",
  "comment": "Please list us under the Silverwater precinct.",
  "elapsedMs": 418322,
  "mediaErrors": []
}
```

### Sample response â€” `201 Created`

The POST response is anonymous and byte-identical for every valid submission.

```json
{
  "message": "Your dealer registration has been received."
}
```

It never returns a submission id, match result, hold reason, company id, or company detail.
Validation and persistence happen in the request; all matching and registration work is queued.
To retrieve the submission id afterwards, list submissions with the GET below and take the newest item.

### Sample response â€” `401 Unauthorized`

Returned when `X-Caravea-Key` is missing or wrong.

```json
{
  "message": "Unauthenticated."
}
```

### Sample response â€” `422 Unprocessable Entity`

Laravel's standard validation error shape, returned when required fields are missing or malformed.

```json
{
  "message": "The dealership name field is required. (and 2 more errors)",
  "errors": {
    "dealershipName": ["The dealership name field is required."],
    "abn": ["The abn field must be 11 digits."],
    "privacyConsent": ["The privacy consent field must be accepted."]
  }
}
```

### curl

```sh
curl -sS -X POST 'https://staging-connect-v3.caravea.au/api/public/dealer-registrations' \
  -H 'X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data-binary @dealer-registration.json
```

## 2. GET the submission list

Lists NoBetterTime submissions newest first, 15 per page.
Use `?page=N` for later pages.
There is no `status` filter, deliberately: filtering opaque acknowledgements would create a company-match oracle.

### Request

```http
GET https://staging-connect-v3.caravea.au/api/public/dealer-registrations?source=nobettertime
X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>
Accept: application/json
```

### Sample response â€” `200 OK`

Each list item has the same shape as the single read below, so a page mixes opaque items and company-created items.
`links` and `meta` are Laravel's standard pagination objects, so their exact key set follows the framework version.

```json
{
  "data": [
    {
      "submission_id": "01J9Q9AQDBPMM2VHWNTBTK1ZZZ",
      "status": "pending",
      "submitted_at": "2026-08-14T04:15:00.000000Z",
      "processed_at": "2026-08-14T04:15:01.000000Z",
      "company": {
        "reference": "caraveacomp|AbCd1234",
        "caravea_company_id": "caraveacomp|AbCd1234",
        "status": "pending",
        "submitted_at": "2026-08-14T04:15:01.000000Z",
        "approved_at": null,
        "rejected_at": null,
        "rejection_reason": null,
        "company": {
          "name": "Outback Caravans Silverwater",
          "slug": "outback-caravans-silverwater",
          "domain": "outbackcaravans.com.au"
        },
        "location": {
          "postcode": "2128"
        },
        "owner_email": "dana@outbackcaravans.com.au",
        "information": {
          "brands": ["Jayco", "New Age"]
        }
      }
    },
    {
      "submission_id": "01J9Q8ZK4M7RBQ0S6WQ2N4XYYY",
      "status": "submitted",
      "submitted_at": "2026-08-14T03:52:11.000000Z",
      "processed_at": "2026-08-14T03:52:12.000000Z"
    },
    {
      "submission_id": "01J9Q7T1V8ND5PZC3JR9KM2XXX",
      "status": "processing",
      "submitted_at": "2026-08-14T03:41:07.000000Z",
      "processed_at": null
    }
  ],
  "links": {
    "first": "https://staging-connect-v3.caravea.au/api/public/dealer-registrations?page=1",
    "last": "https://staging-connect-v3.caravea.au/api/public/dealer-registrations?page=3",
    "prev": null,
    "next": "https://staging-connect-v3.caravea.au/api/public/dealer-registrations?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 3,
    "path": "https://staging-connect-v3.caravea.au/api/public/dealer-registrations",
    "per_page": 15,
    "to": 15,
    "total": 42
  }
}
```

### curl

```sh
curl -sS 'https://staging-connect-v3.caravea.au/api/public/dealer-registrations?source=nobettertime' \
  -H 'X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>' \
  -H 'Accept: application/json'
```

## 3. GET one submission

`submission_id` is the ULID returned by a list item.
It is not a Connect company id.
Unknown or non-NoBetterTime ULIDs return `404 Not Found`.

### Request

```http
GET https://staging-connect-v3.caravea.au/api/public/dealer-registrations/01J9Q9AQDBPMM2VHWNTBTK1ZZZ?source=nobettertime
X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>
Accept: application/json
```

### Sample response A â€” still processing

Until the worker finishes, the status is `processing` and `processed_at` is null.

```json
{
  "data": {
    "submission_id": "01J9Q7T1V8ND5PZC3JR9KM2XXX",
    "status": "processing",
    "submitted_at": "2026-08-14T03:41:07.000000Z",
    "processed_at": null
  }
}
```

### Sample response B â€” opaque acknowledgement

Every outcome that did not create a Connect company from this submission collapses to this identical `submitted` status.
A match to an existing Connect company, an administrator hold, a discarded hold, and a terminal worker failure are indistinguishable here by design, so the response cannot disclose whether the named business already exists.

```json
{
  "data": {
    "submission_id": "01J9Q8ZK4M7RBQ0S6WQ2N4XYYY",
    "status": "submitted",
    "submitted_at": "2026-08-14T03:52:11.000000Z",
    "processed_at": "2026-08-14T03:52:12.000000Z"
  }
}
```

There is no `company`, `caravea_company_id`, `owner_email`, raw `submission`, or `hold_reason` field in an opaque acknowledgement.
Do not treat the absence of `company` as a failure signal: it is the expected shape for a successful match as well.

### Sample response C â€” company created from this submission

Only when this submission created the Connect company is `company` present.

```json
{
  "data": {
    "submission_id": "01J9Q9AQDBPMM2VHWNTBTK1ZZZ",
    "status": "pending",
    "submitted_at": "2026-08-14T04:15:00.000000Z",
    "processed_at": "2026-08-14T04:15:01.000000Z",
    "company": {
      "reference": "caraveacomp|AbCd1234",
      "caravea_company_id": "caraveacomp|AbCd1234",
      "status": "pending",
      "submitted_at": "2026-08-14T04:15:01.000000Z",
      "approved_at": null,
      "rejected_at": null,
      "rejection_reason": null,
      "company": {
        "name": "Outback Caravans Silverwater",
        "slug": "outback-caravans-silverwater",
        "domain": "outbackcaravans.com.au"
      },
      "location": {
        "postcode": "2128"
      },
      "owner_email": "dana@outbackcaravans.com.au",
      "information": {
        "brands": ["Jayco", "New Age"]
      }
    }
  }
}
```

The nested company id, owner email, company details, location, and information are available only for a submission-created company.
They are never returned for a pre-existing Connect company merely matched by the form.

### Sample response â€” `404 Not Found`

```json
{
  "message": "Not Found."
}
```

### curl

```sh
curl -sS 'https://staging-connect-v3.caravea.au/api/public/dealer-registrations/01J9Q9AQDBPMM2VHWNTBTK1ZZZ?source=nobettertime' \
  -H 'X-Caravea-Key: <CONNECT_API_KEY — see Obsidian vault, and the server backend/.env>' \
  -H 'Accept: application/json'
```

---

# OUTBOUND â€” Connect â†’ NoBetterTime

Connect pushes a dealer state snapshot to NoBetterTime after a dealer is approved and after a Team administrator saves Company Information.
The events are `dealer.approved` and `company_information.updated`.

## Activation

Connect sends nothing until **both** variables are set:

```dotenv
NOBETTERTIME_SYNC_URL=https://nobettertime.example/api/dealers/sync
NOBETTERTIME_SYNC_SECRET=replace-with-a-shared-random-secret
```

If either is unset or blank, sync is dormant: Connect does not enqueue a job, make a request, or fail a dealer approval or a Company Information save.
That is the current production and staging state until NoBetterTime provides its endpoint and secret.

## Request headers

```http
POST {NOBETTERTIME_SYNC_URL}
Accept: application/json
Content-Type: application/json
X-Caravea-Timestamp: 2026-08-14T12:00:00+00:00
X-Caravea-Signature: sha256={lowercase-hex-hmac}
```

The timestamp is UTC ISO-8601.
The signature is computed over the exact JSON bytes transmitted, with no re-encoding on either side:

```
lowercase-hex-hmac = HMAC-SHA256(
  X-Caravea-Timestamp + "\n" + raw-request-body,
  NOBETTERTIME_SYNC_SECRET
)
```

The `sha256=` prefix is part of the header value, not part of the digest.
The receiver should reject a missing or invalid signature and should validate an acceptable timestamp window before accepting the payload.

**Testing gotcha:** the sample body below is pretty-printed for reading, and Connect transmits compact JSON.
A signature computed over the pretty-printed text will not match the one Connect sends.
Always sign and verify the bytes actually on the wire.

## Sample outbound payload

Same dealer as the inbound examples above, so a full round trip can be traced end to end.

```json
{
  "version": 1,
  "event": "company_information.updated",
  "occurred_at": "2026-08-14T12:00:00+00:00",
  "company": {
    "caravea_company_id": "caraveacomp|AbCd1234",
    "name": "Outback Caravans Silverwater",
    "type": "DEALER",
    "status": "approved",
    "domain": "outbackcaravans.com.au",
    "website": "https://outbackcaravans.com.au",
    "phone_number": "(02) 9748 1122",
    "email": "enquiries@outbackcaravans.com.au",
    "description": "Family-owned caravan dealership serving Western Sydney.",
    "address": "12 Silverwater Road",
    "state": "NSW",
    "services": ["New sales", "Used sales", "Servicing"],
    "open_hours": "<p>Monday: 8:30â€“17:00</p>"
  },
  "company_information": {
    "legal_name": "Outback Caravans Pty Ltd",
    "abn": "51 824 753 556",
    "latitude": -33.83320000,
    "longitude": 151.04310000,
    "geocode_precision": "street",
    "geocode_source": "nobettertime",
    "geocoded_address": "12 Silverwater Road, Silverwater NSW 2128",
    "established": 1998,
    "dms": "Caravea Connect",
    "dms_other": null,
    "motor_dealer_licence_name": "Outback Caravans Pty Ltd",
    "motor_dealer_licence_number": "MD-0491287",
    "leads_email": "leads@outbackcaravans.com.au",
    "sms_number": "+61 412 987 654",
    "contact_name": "Dana Whitlock",
    "contact_role": "Dealer Principal",
    "google_profile": "https://g.page/outback-caravans-silverwater",
    "services": ["New sales", "Used sales", "Servicing"],
    "services_other": "Annual gas & electrical compliance",
    "brands": ["Jayco", "New Age"],
    "brands_other": null,
    "product_types": ["Pop top", "Full-size touring", "Off-road"],
    "products_other": null,
    "stock_condition": "Both",
    "multiple_locations": true,
    "finance_available": true,
    "delivery_available": true,
    "rvmap_badged": false,
    "rvmaster_badged": true,
    "trading_hours": {
      "monday": { "open": true, "openTime": "08:30", "closeTime": "17:00" },
      "sunday": { "open": false, "openTime": "", "closeTime": "" }
    },
    "logo_url": "https://syd1.digitaloceanspaces.com/media-caravea/nobettertime/dealers/outback/logo.png",
    "photo_urls": [
      "https://syd1.digitaloceanspaces.com/media-caravea/nobettertime/dealers/outback/yard.png"
    ],
    "state_association": "Caravan & Camping Industry Association NSW"
  },
  "locations": [
    {
      "address": "12 Silverwater Road",
      "city": "Silverwater",
      "state": "NSW",
      "postcode": "2128",
      "country": "Australia",
      "latitude": -33.83320000,
      "longitude": 151.04310000
    }
  ]
}
```

Three shape rules travel with this body.
`company_information` is `null` when Connect has no corresponding record.
`locations` is an array and can be empty.
Optional values are sent as `null` rather than being omitted.

## Sample `dealer.approved` payload

Same envelope, different event, and typically fired before Company Information exists.

```json
{
  "version": 1,
  "event": "dealer.approved",
  "occurred_at": "2026-08-14T11:02:44+00:00",
  "company": {
    "caravea_company_id": "caraveacomp|AbCd1234",
    "name": "Outback Caravans Silverwater",
    "type": "DEALER",
    "status": "approved",
    "domain": "outbackcaravans.com.au",
    "website": null,
    "phone_number": "(02) 9748 1122",
    "email": "enquiries@outbackcaravans.com.au",
    "description": null,
    "address": "12 Silverwater Road",
    "state": "NSW",
    "services": [],
    "open_hours": null
  },
  "company_information": null,
  "locations": []
}
```

## Expected response from NoBetterTime

Any `2xx` is treated as accepted.
The response body is not parsed, so an empty `200` or a small acknowledgement both work.

```json
{
  "received": true
}
```

A `4xx` marks the attempt failed without an immediate HTTP retry.
A `5xx` or a connection failure gets one immediate retry after 250 ms.

## Delivery and retry behaviour

- Connect uses a queued job and never lets a NoBetterTime failure fail the approval or the Company Information save.
- Connection timeout defaults to 5 seconds and the full HTTP timeout to 20 seconds, overridable with `NOBETTERTIME_SYNC_CONNECT_TIMEOUT` and `NOBETTERTIME_SYNC_TIMEOUT`.
- Within a queue attempt, transient connection failures and HTTP 5xx get one immediate retry after 250 ms, giving two HTTP attempts.
- HTTP 4xx does not get that immediate retry.
- The queue job permits three attempts with a backoff schedule of 60, 300, then 900 seconds; after the final failed attempt Connect records a warning.
- A queue retry can therefore re-attempt a 4xx as well as a transient failure.
- Jobs are unique per caravea company id plus event, so the same event for the same dealer cannot be queued twice while an approval and an information update can still coexist.

NoBetterTime should treat deliveries as idempotent.
The stable company key is `company.caravea_company_id`, and `event` plus `occurred_at` identify the delivery that produced a particular state snapshot.

## Local receiver for testing

A reference receiver that verifies the signature lives in the Connect repo at `scripts/nobettertime_sync_receiver.py`.
Point `NOBETTERTIME_SYNC_URL` at it and set the same secret on both sides to exercise the outbound path without NoBetterTime's real endpoint.

---

# Constraints the API enforces but does not document

Found by live probing against staging, not in any Connect-side spec:

- **`logo` and `photos` are REQUIRED.** Omitting either field 422s. `photos: []` counts as missing
  the same as an omitted key — Connect requires at least one entry.
- **`logo`/`photos` must be https on an approved media host.** Arbitrary hosts are rejected with
  `"logo must be an https URL hosted on an approved media host"`. Our mapper (`connect-registration.ts`)
  now gates both fields against the same DO Spaces allow-list `public-dealer.ts` uses
  (`utils/trusted-media-url.ts`) before ever building the payload, so an untrusted URL is treated the
  same as a missing one and the row is skipped (`missing-logo` / `missing-photos`), never sent.
- **`productTypes` is a closed enum.** `"Caravan"` is rejected with `"selected productTypes.0 is
  invalid"`. The values our `options.ts` actually sends — `"Pop top"`, `"Off-road"`, etc. — are
  accepted.
- **`website` must be unique across dealers.** A second dealer registered with the same website gets
  `"This dealership website is already registered"`, and the error is misattributed to
  `dealershipName` in the response rather than to `website`. **This is an open problem for us, not
  something to work around in code:** 37 of our 161 dealers legitimately share a corporate website
  across multiple locations (MDC 9 sites, SUV Caravans 5, Lawrence RV 4, JB 4, Apollo 3) and will be
  rejected on a real push until Connect's side relaxes or scopes this uniqueness constraint.

# Notes and open discrepancies

- **`source` on GET.** This staging document requires `source=nobettertime` on both POST and GET, while the read contract at `data/dealer-holds-security/nobettertime-read-contract.md` documents the GET endpoints without it. Send it, and if a GET returns an unexpected result without it, that discrepancy is the first thing to check.
- **Company id prefix.** The outbound contract at `data/dealer-nbt-resync/nobettertime-contract.md` uses a `dealer|abc123` worked example, while the read API returns the `caraveacomp|AbCd1234` form. The samples above use the `caraveacomp|` form throughout, since that is what the read API actually emits.
- **One shared key, one holder.** NoBetterTime is the only holder of the inbound ecosystem key. Every key holder can read every NoBetterTime submission record, so a second caller must not be given this key without per-caller keys and persisted caller identity built first.
- **Two independent credentials.** The inbound `X-Caravea-Key` and the outbound `NOBETTERTIME_SYNC_SECRET` are unrelated. Enabling one does not enable the other.
