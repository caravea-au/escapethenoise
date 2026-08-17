/**
 * Caravea Connect pull — the source of truth for /find-dealer.
 *
 * SERVER ONLY. `CONNECT_API_KEY` must never gain a `NEXT_PUBLIC_` prefix; this
 * module is imported by a server component and nothing here may be pulled into
 * a client bundle. (`server-only` is not a dependency of this repo, which is
 * why that is a comment and not a compile error — if it is ever added, import
 * it at the top of this file first.)
 *
 * Transport is a PULL, not the HMAC-signed push webhook. Connect sends nothing
 * until their ops set `NOBETTERTIME_SYNC_URL` + `NOBETTERTIME_SYNC_SECRET`,
 * which is not something we can do from this side; the GET below works today
 * and returns the whole company/location/information tree, so it needs neither
 * the shared secret nor a public internet-facing receiver.
 *
 * Everything reaching `DirectoryDealer` reaches the browser: DealerDirectory is
 * a "use client" island and the page hands it the whole array, so every mapped
 * field is serialised into the RSC payload. `toDirectoryDealer` therefore
 * builds a FRESH object field by field and never spreads a Connect record —
 * `owner_email`, `abn`, `legal_name`, `leads_email`, `sms_number`, the
 * submitter contact block, licence numbers and the consent flags all sit in the
 * response we read and none of them may be published.
 */

import type { DirectoryDealer, DealerTradingHours } from "@/lib/strapi";

const REGISTRATIONS_PATH = "/api/public/dealer-registrations";

// Connect pins its own page size at 15 and IGNORES `per_page`/`limit`
// (measured: both come back with `meta.per_page: 15`), so a full read is
// `ceil(total / 15)` sequential requests. The staging deploy script wipes
// `.next/cache/fetch-cache`, so the first visitor after every deploy pays all
// of them — hence the per-request timeout and the page cap below.
const PAGE_SIZE = 15;
const MAX_PAGES = 40;
const REQUEST_TIMEOUT_MS = 8_000;

// Cache lifetime for the whole pull. This is the ONLY thing making /find-dealer
// cheap: the route awaits `searchParams`, so it is fully dynamic and is not in
// the prerender manifest — it gets no ISR of its own. Adding `cache: "no-store"`
// below would silently turn this into one full Connect read per visitor, and no
// test would fail.
const REVALIDATE_SECONDS = 300;

// ── Media trust ──────────────────────────────────────────────────────────────
// Mirror of backend/src/utils/trusted-media-url.ts. `logo_url`/`photo_urls`
// arrive from Connect as free-text strings and go straight into an <img src>,
// so host alone is not enough: syd1.digitaloceanspaces.com is DigitalOcean's
// SHARED regional endpoint used by every Spaces customer in that region, and
// real URLs are path-style (https://<host>/<bucket>/<rootPath>/file.jpg).
// Without the bucket + root-path pin, anyone with a syd1 Space could choose the
// image bytes rendered on our directory.
//
// Bucket and root path differ per environment (`nobettertime` on prod,
// `nobettertime-staging` on staging), so they are read from env rather than
// hardcoded. If either is unset the prefix collapses to "/" + "/" and EVERY
// media URL is rejected — deliberately a loud, visible failure (missing logos)
// rather than a silent widening of what we will render.
const MEDIA_HOST = safeHostname(
  process.env.DO_SPACE_ENDPOINT ||
    process.env.NEXT_PUBLIC_UPLOADS_URL ||
    "https://syd1.digitaloceanspaces.com",
);

const MEDIA_PATH_PREFIX = `/${[process.env.DO_SPACE_BUCKET, process.env.DO_SPACE_ROOT_PATH]
  .filter(Boolean)
  .join("/")}/`;

function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isTrustedMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || !MEDIA_HOST) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === MEDIA_HOST &&
      url.pathname.startsWith(MEDIA_PATH_PREFIX)
    );
  } catch {
    return false; // not a parseable absolute URL
  }
}

// ── Readers ──────────────────────────────────────────────────────────────────
// Connect's tree is read defensively at every level: a missing branch yields an
// empty object rather than throwing, so one malformed record can never take the
// whole directory down.

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Connect serialises decimals as STRINGS (`"-37.82530000"`), so a `typeof
 * value === "number"` guard silently drops every coordinate. Parsed here and
 * rejected unless finite.
 */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(str).filter((item): item is string => item !== null);
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * `established` is a plain integer year on Connect, but one real row in our own
 * data carries `25`. Anything outside a sane range reads as absent rather than
 * being rendered as a year.
 */
function establishedYear(value: unknown): number | null {
  const parsed = num(value);
  if (parsed === null) return null;
  const year = Math.trunc(parsed);
  return year >= 1800 && year <= new Date().getFullYear() ? year : null;
}

/**
 * Trading hours come back on `information.trading_hours` as the structured
 * day-keyed object we originally sent, which `isOpenNow`/`todayHoursLabel`
 * already parse defensively.
 *
 * `company.open_hours` is a DIFFERENT field holding rendered HTML
 * (`"<p>Monday: 8:30-17:00</p>"`). It is never read here and must never be:
 * putting Connect-authored HTML on the page is stored XSS.
 */
function tradingHours(value: unknown): DealerTradingHours {
  const parsed = obj(value);
  return Object.keys(parsed).length > 0 ? (parsed as unknown as DealerTradingHours) : null;
}

/**
 * Whether this dealer is approved on Connect, and therefore whether the enquiry
 * form renders for them (see DealerModal).
 *
 * Connect is adding an explicit approval boolean to the outbound payload. It is
 * not on the read shape yet, so this checks for it first under each of the
 * names it could plausibly ship as, then falls back to what the tree exposes
 * today: `company.status` (currently `"pending"` on every record) and
 * `company.approved_at`. Default is FALSE — an unreadable or unrecognised
 * approval state must not open the form.
 *
 * This is a display gate only. The real enforcement is server-side in the
 * dealer-enquiry controller, which re-checks approval against Connect before
 * storing anything.
 */
function isApproved(record: Json, company: Json): boolean {
  for (const key of ["approved", "is_approved", "isApproved"]) {
    const explicit = bool(company[key]) ?? bool(record[key]);
    if (explicit !== null) return explicit;
  }

  const status = str(company.status) ?? str(record.status);
  if (status) return status.toLowerCase() === "approved";

  return str(company.approved_at) !== null;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/**
 * One Connect registration → the public directory shape, by explicit
 * assignment only. Returns null for a record with no usable identity, so a
 * half-formed row is skipped rather than rendered as a blank card.
 */
function toDirectoryDealer(record: Json): DirectoryDealer | null {
  const company = obj(record.company);
  const profile = obj(company.company);
  const location = obj(company.location);
  const information = obj(company.information);

  // `submission_id` is Connect's stable per-registration id and the only
  // identifier both sides can name. It becomes `documentId` here because that
  // is what the directory keys cards, map pins and the enquiry POST on — it is
  // NOT a Strapi documentId any more, which is exactly why the enquiry
  // controller had to learn to resolve an external dealer.
  const documentId = str(record.submission_id);
  const dealershipName = str(profile.name);
  if (!documentId || !dealershipName) return null;

  const logo = information.logo_url ?? profile.logo_url;

  return {
    documentId,
    dealershipName,

    street: str(location.address),
    suburb: str(location.city),
    state: str(location.state_province),
    postcode: str(location.postcode),

    phone: str(profile.phone_number),
    website: str(profile.website),
    description: str(profile.description),

    logo: isTrustedMediaUrl(logo) ? logo : null,
    photos: strArray(information.photo_urls).filter(isTrustedMediaUrl),

    facebook: str(profile.facebook),
    instagram: str(profile.instagram),
    youtube: str(profile.youtube),
    googleProfile: str(information.google_profile),

    tradingHours: tradingHours(information.trading_hours),

    // `information` carries the full onboarding answers; `profile.services` is
    // a shorter echo of the same list, used only as a fallback.
    services: strArray(information.services ?? profile.services),
    servicesOther: str(information.services_other),
    brands: strArray(information.brands),
    brandsOther: str(information.brands_other),
    productTypes: strArray(information.product_types),
    productsOther: str(information.products_other),
    stockCondition: stockCondition(information.stock_condition),

    financeAvailable: bool(information.finance_available),
    deliveryAvailable: bool(information.delivery_available),
    rvmapBadged: bool(information.rvmap_badged),
    rvmasterBadged: bool(information.rvmaster_badged),
    established: establishedYear(information.established),
    multipleLocations: bool(information.multiple_locations),
    stateAssociation: str(information.state_association),

    latitude: num(location.latitude),
    longitude: num(location.longitude),
    // Connect stores no precision field, so every Connect coordinate is treated
    // as approximate and keeps its "~" in distance labels. Claiming "street"
    // here would print a false decimal distance. Dealers Connect has no
    // coordinate for fall back to their postcode centroid in `dealerPoint`.
    precision: null,

    approved: isApproved(record, company),
  };
}

const STOCK_CONDITIONS = ["New", "Used", "Both"] as const;

/** Narrows to the three values the directory understands; anything else is absent. */
function stockCondition(value: unknown): DirectoryDealer["stockCondition"] {
  const parsed = str(value);
  return STOCK_CONDITIONS.find((c) => c === parsed) ?? null;
}

// ── Fetching ─────────────────────────────────────────────────────────────────

type PageResult = { records: Json[]; lastPage: number };

async function fetchPage(baseUrl: string, apiKey: string, page: number): Promise<PageResult> {
  // `source=nobettertime` is REQUIRED on every request. Without it Connect does
  // not 400 — it 302s to its own login page, which then "succeeds" as HTML and
  // fails to parse. This is also why `links.next` from the response is never
  // followed: their pagination URLs drop the parameter.
  const url = `${baseUrl.replace(/\/+$/, "")}${REGISTRATIONS_PATH}?source=nobettertime&page=${page}`;

  const response = await fetch(url, {
    headers: { "X-Caravea-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS, tags: ["connect-dealers"] },
  });

  if (!response.ok) {
    // Never log the body: Connect's error responses echo submitted values,
    // which for this endpoint means dealer PII in plaintext logs.
    throw new Error(`Connect dealer-registrations request failed (${response.status}) on page ${page}`);
  }

  const json = obj(await response.json());
  const meta = obj(json.meta);

  return {
    records: Array.isArray(json.data) ? json.data.map(obj) : [],
    lastPage: Math.max(1, num(meta.last_page) ?? 1),
  };
}

/**
 * Every dealer Connect holds for this site, mapped to the directory shape.
 *
 * Throws when Connect is unreachable or misconfigured — same contract as the
 * Strapi collection getters it replaces, so find-dealer/page.tsx can tell an
 * outage (show the "can't load" panel) apart from a genuinely empty directory
 * (show the "no dealers listed yet" panel). Those are very different messages
 * to a visitor, and right now the empty one is the truthful case: Connect
 * staging holds three test registrations and no approved dealer.
 */
export async function getConnectDealers(): Promise<DirectoryDealer[]> {
  const baseUrl = process.env.CONNECT_API_URL;
  const apiKey = process.env.CONNECT_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Connect is not configured (CONNECT_API_URL / CONNECT_API_KEY)");
  }

  const first = await fetchPage(baseUrl, apiKey, 1);
  const records = [...first.records];

  const lastPage = Math.min(first.lastPage, MAX_PAGES);
  for (let page = 2; page <= lastPage; page++) {
    const next = await fetchPage(baseUrl, apiKey, page);
    records.push(...next.records);
  }

  if (first.lastPage > MAX_PAGES) {
    // Never truncate silently — a capped read looks identical to a complete one.
    console.warn(
      `[connect] dealer read capped at ${MAX_PAGES} pages (~${MAX_PAGES * PAGE_SIZE} dealers); Connect reports ${first.lastPage} pages`,
    );
  }

  return records
    .map(toDirectoryDealer)
    .filter((dealer): dealer is DirectoryDealer => dealer !== null);
}

/**
 * Dealers per state (`{ VIC: 28, NSW: 46 }`) for the state tiles, derived from
 * the same array the list renders.
 *
 * Deliberately NOT a second endpoint. The tiles used to come from Strapi's
 * /api/dealer-counts while the list came from somewhere else, which meant a
 * tile could advertise a count the page it linked to could not produce.
 */
export function connectStateCounts(dealers: DirectoryDealer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const dealer of dealers) {
    if (!dealer.state) continue;
    counts[dealer.state] = (counts[dealer.state] ?? 0) + 1;
  }
  return counts;
}
