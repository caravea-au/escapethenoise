// Pure helpers for the dealer directory (find-dealer). No React here — these
// are shared by server rendering and, later, the client-side directory island.
//
// Attribution: `au-postcode-centroids.json`, and most per-dealer coordinates now
// served by /api/dealers, were geocoded from OpenStreetMap data via the Nominatim
// API. They are licensed ODbL, which requires attribution wherever they are
// displayed — any map UI that renders these coordinates MUST show
// "© OpenStreetMap contributors" (see https://www.openstreetmap.org/copyright).
// Coordinates a dealer placed themselves are their own contribution, and the
// `geocodeSource` field on the dealer record notes which is which (it is not
// public, so it is not visible here).

import type { DirectoryDealer, DealerTradingHours } from "@/lib/strapi";
import centroids from "@/lib/au-postcode-centroids.json";

type Centroids = Record<string, [number, number]>;
const CENTROIDS = centroids as unknown as Centroids;

/** Postcode → `[lat, lng]` centroid, or null if unknown. Normalises whitespace and pads short numeric codes (e.g. "829" → "0829"). */
export function centroidFor(postcode: string | null | undefined): [number, number] | null {
  if (!postcode) return null;
  const trimmed = postcode.trim();
  if (!trimmed) return null;
  const key = /^\d+$/.test(trimmed) ? trimmed.padStart(4, "0") : trimmed;
  return CENTROIDS[key] ?? null;
}

/** A dealer's map position, and whether it is exact enough to quote a precise distance. */
export type DealerPoint = { coords: [number, number]; precise: boolean };

/**
 * Where a dealer sits on the map: their own coordinates when we have them, else
 * the postcode centroid, else null (they are counted as "not shown" rather than
 * silently dropped).
 *
 * Coordinates are fields on the dealer record itself, served flat by
 * /api/dealers. They used to live in a committed `dealer-geocodes.json` sidecar,
 * which meant a wrong pin needed a code deploy to move and a newly onboarded
 * dealer sat on a postcode centroid until someone ran a script. Now a dealer
 * places their own pin on the onboarding form and staff can correct any pin in
 * the admin, and both show up within the ISR window.
 *
 * `precise` is true only for street-level coordinates. Postcode centroids and
 * approximate geocodes keep their "~" in distance labels.
 */
export function dealerPoint(
  dealer: Pick<DirectoryDealer, "postcode" | "latitude" | "longitude" | "precision">,
): DealerPoint | null {
  // Guard on both being finite rather than truthy: longitude 0 is falsy, and
  // while that is in the Atlantic rather than Australia, a truthiness test here
  // is the kind of thing that survives into a codebase that later isn't AU-only.
  if (
    typeof dealer.latitude === "number" &&
    typeof dealer.longitude === "number" &&
    Number.isFinite(dealer.latitude) &&
    Number.isFinite(dealer.longitude)
  ) {
    return {
      coords: [dealer.latitude, dealer.longitude],
      precise: dealer.precision === "street",
    };
  }
  const centroid = centroidFor(dealer.postcode);
  return centroid ? { coords: centroid, precise: false } : null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two `[lat, lng]` points, in kilometres. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Human distance label. Only drops the `~` and shows a decimal when BOTH ends
 * are exact — the user's own GPS position measured to a street-level dealer
 * geocode. A postcode-centroid origin or a suburb-level dealer fallback is
 * approximate, and keeps the `~` and whole kilometres rather than inventing
 * precision the coordinates don't have.
 */
export function formatDistance(km: number, precise = false): string {
  if (precise) return km < 10 ? `${km.toFixed(1)}km away` : `${Math.round(km)}km away`;
  if (km < 1) return "~<1km away";
  return `~${Math.round(km)}km away`;
}

/** Distance from an origin to a dealer, labelled honestly about both ends' precision. Null when the dealer has no coordinate at all. */
export function distanceLabelFor(
  origin: DealerOrigin | null,
  dealer: Pick<DirectoryDealer, "postcode" | "latitude" | "longitude" | "precision">,
): string | null {
  if (!origin) return null;
  const point = dealerPoint(dealer);
  if (!point) return null;
  return formatDistance(haversineKm(origin.coords, point.coords), origin.precise && point.precise);
}

// Australia spans multiple DST rules (WA/QLD/NT don't observe it), so a naive
// `new Date()` is wrong for roughly half the year in those states. Resolve
// weekday/time via Intl in the dealer's own zone instead.
export const AU_STATE_TZ: Record<string, string> = {
  VIC: "Australia/Melbourne",
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane",
  SA: "Australia/Adelaide",
  NT: "Australia/Darwin",
  WA: "Australia/Perth",
};

type DayKey = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

function localWeekdayAndMinutes(nowMs: number, timeZone: string): { weekday: DayKey; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(nowMs));
    const weekday = parts.find((p) => p.type === "weekday")?.value as DayKey | undefined;
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return { weekday, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/** Parses "HH:MM" to minutes-since-midnight, or null if unparseable. */
function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Whether a dealer is open right now, resolved in the dealer's own timezone.
 * Returns `null` (rather than a wrong "Closed") whenever hours are missing,
 * the state can't be mapped to a timezone, or a time string is unparseable —
 * callers should render nothing in that case.
 */
export function isOpenNow(
  tradingHours: DealerTradingHours,
  state: string | null | undefined,
  nowMs: number,
): boolean | null {
  if (!tradingHours || !state) return null;
  const tz = AU_STATE_TZ[state];
  if (!tz) return null;
  const local = localWeekdayAndMinutes(nowMs, tz);
  if (!local) return null;
  const day = tradingHours[local.weekday];
  if (!day) return null;
  if (!day.open) return false;
  const openMin = parseTimeToMinutes(day.openTime);
  const closeMin = parseTimeToMinutes(day.closeTime);
  if (openMin === null || closeMin === null) return null;
  if (closeMin > openMin) {
    return local.minutes >= openMin && local.minutes < closeMin;
  }
  // Close time at/before open time: treat as spanning midnight (e.g. 18:00–02:00).
  return local.minutes >= openMin || local.minutes < closeMin;
}

/** 12-hour clock label, e.g. "9:00am", "5:30pm". */
function format12Hour(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

/**
 * "Today · 9:00am – 5:30pm" style label for the dealer's current local day,
 * or "Today · Closed" / null when hours can't be resolved.
 */
export function todayHoursLabel(
  tradingHours: DealerTradingHours,
  state: string | null | undefined,
  nowMs: number,
): string | null {
  if (!tradingHours || !state) return null;
  const tz = AU_STATE_TZ[state];
  if (!tz) return null;
  const local = localWeekdayAndMinutes(nowMs, tz);
  if (!local) return null;
  const day = tradingHours[local.weekday];
  if (!day) return null;
  if (!day.open) return "Today · Closed";
  const openMin = parseTimeToMinutes(day.openTime);
  const closeMin = parseTimeToMinutes(day.closeTime);
  if (openMin === null || closeMin === null) return null;
  return `Today · ${format12Hour(openMin)} – ${format12Hour(closeMin)}`;
}

/**
 * Formats a dealer's `phone` field for display, plus the compact digit string
 * to use as a `tel:` href (or `null` when the value isn't a phone number at
 * all).
 *
 * The five recognised shapes below are exactly what was MEASURED across the
 * 164 real dealer records: 10-digit mobiles (`04`), 10-digit 1300/1800
 * numbers, 10-digit landlines (`0X XXXX XXXX`, the common case), bare
 * 8-digit landlines with no area code, and 6-digit `13` numbers. Nothing else
 * is invented.
 *
 * The fallback matters more than it looks: one real production dealer's
 * `phone` field literally contains the text "Maple Leaf Automotive Pty Ltd".
 * Anything that doesn't match a recognised shape is returned completely
 * unchanged, with `tel: null`, so it renders as plain text rather than a
 * broken `tel:` link. Do not "simplify" this fallback away: it is load
 * bearing for that record, not defensive padding.
 */
export function formatPhone(raw: string | null): { display: string; tel: string | null } {
  if (!raw) return { display: "", tel: null };

  // A leading +61 is Australia's country code for a domestic 0-prefixed
  // number, so normalise it before stripping punctuation and "+61 3 9088 6599"
  // and "03 9088 6599" land on the same digit string.
  const trimmed = raw.trim();
  const withoutCountryCode = trimmed.startsWith("+61") ? `0${trimmed.slice(3)}` : trimmed;
  const digits = withoutCountryCode.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("04")) {
    return { display: `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`, tel: digits };
  }
  if (digits.length === 10 && (digits.startsWith("1300") || digits.startsWith("1800"))) {
    return { display: `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`, tel: digits };
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return { display: `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`, tel: digits };
  }
  if (digits.length === 8) {
    return { display: `${digits.slice(0, 4)} ${digits.slice(4)}`, tel: digits };
  }
  if (digits.length === 6 && digits.startsWith("13")) {
    return { display: `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`, tel: digits };
  }

  return { display: raw, tel: null };
}

const SALES_SERVICES = new Set(["New sales", "Used sales"]);

/** Map pin colour category (design.md §6 — rust = sales, green = service, `#3a7d4e` = rental). */
export function dealerPinType(services: string[]): "sales" | "service" | "rental" {
  const hasRentals = services.includes("Rentals / hire");
  const hasSales = services.some((s) => SALES_SERVICES.has(s));
  if (hasRentals && !hasSales) return "rental";
  if (hasSales) return "sales";
  return "service";
}

// Filter-bar service chips. There is no "Special Offers" chip and no rating
// data — both were invented in the export and must not be built.
export type ChipKey = "Sales" | "Service" | "Rentals" | "Off-Road" | "Open Now";

const SERVICE_CHIP_SERVICES = new Set([
  "Servicing",
  "Warranty repairs",
  "Workshop / repairs",
  "Mobile servicing",
]);
const OFF_ROAD_PRODUCT_TYPES = new Set(["Off-road", "Off-grid"]);

export const CHIP_PREDICATES: Record<ChipKey, (dealer: DirectoryDealer, nowMs: number) => boolean> = {
  Sales: (d) => d.services.some((s) => SALES_SERVICES.has(s)),
  Service: (d) => d.services.some((s) => SERVICE_CHIP_SERVICES.has(s)),
  Rentals: (d) => d.services.includes("Rentals / hire"),
  "Off-Road": (d) => d.productTypes.some((t) => OFF_ROAD_PRODUCT_TYPES.has(t)),
  "Open Now": (d, nowMs) => isOpenNow(d.tradingHours, d.state, nowMs) === true,
};

// The states this dealer programme currently operates in. This is the ONE list
// that decides which dealers reach the directory at all: the state tiles, the
// listing, the map, the header count and the filter dropdown are every one of
// them derived from it, so putting a code back here (or taking one out) is the
// only edit needed to change which states appear anywhere on /find-dealer
// (ETN-007 restricted the tiles, ETN-011 the dropdown, ETN-012 the rest).
//
// Excluding every other state and territory is TEMPORARY, and presentation
// only: no dealer record is touched, and an excluded dealer still registers,
// still exists in Caravea Connect and is still reachable by id for enquiries.
// The permanent answer is a client-editable list (ETN-009); this constant is
// the stopgap that buys time for it.
/**
 * Whether this dealer can be sent an enquiry, and therefore whether the form is
 * rendered for them at all.
 *
 * TWO independent conditions, ANDed, and neither implies the other:
 *
 *  1. `enquiryFormEnabled`, ONE site-wide switch in Strapi's Dealer Directory
 *     Settings (#70), covering the whole directory at once.
 *  2. `hasCaraveaCompanyId`, per dealer (ETN-017). Connect issues that id on
 *     approval, so a dealer it has not approved has nothing to attribute a lead
 *     to and is offered no form.
 *
 * Lives here rather than inline in each component because DealerCard's
 * "& Enquire" wording and DealerModal's form have to answer this identically:
 * a card that promises an enquiry and opens on a modal with no form is the exact
 * defect ETN-017 AC6 names. One predicate, two callers, guaranteed to agree.
 *
 * Deliberately NOT gated on `approved`: that drives the badge and only the badge
 * (ETN-006). It agrees with this today because Connect mints the id on approval,
 * but they are answers to different questions and are allowed to disagree.
 */
export function canEnquire(dealer: DirectoryDealer, enquiryFormEnabled: boolean): boolean {
  return enquiryFormEnabled && dealer.hasCaraveaCompanyId;
}

export const PARTICIPATING_STATES: readonly string[] = ["NSW", "VIC", "QLD"];

/**
 * The dealers the directory is allowed to show. A dealer with no state at all
 * is excluded too: it cannot be in a participating state, and leaving it in
 * would put a card on the page that no tile, count or filter can account for.
 */
export function participatingDealers(dealers: DirectoryDealer[]): DirectoryDealer[] {
  return dealers.filter((d) => !!d.state && PARTICIPATING_STATES.includes(d.state));
}

/**
 * Dealers per state (`{ VIC: 28, NSW: 46 }`) for the state tiles, derived from
 * the same array the list renders.
 *
 * Deliberately NOT read from Strapi /api/dealer-counts, which still exists and
 * still answers. The tiles used to come from that endpoint while the list came
 * from somewhere else, which meant a tile could advertise a count the page it
 * linked to could not produce. Counting off the rendered array makes the subtitle
 * total the sum of the tiles by construction.
 */
export function dealerStateCounts(dealers: DirectoryDealer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const dealer of dealers) {
    if (!dealer.state) continue;
    counts[dealer.state] = (counts[dealer.state] ?? 0) + 1;
  }
  return counts;
}

export type DealerFilterOptions = {
  states: string[];
  brands: string[];
  productTypes: string[];
  services: string[];
};

/**
 * Sorted unique option lists actually present in the loaded dealers, so every dropdown option yields
 * at least one result. `states` is additionally narrowed to PARTICIPATING_STATES: the dropdown mirrors
 * Connect's data, so without this it re-offers every state Connect happens to hold. Brands, product
 * types and services are unrestricted.
 */
export function deriveFilterOptions(dealers: DirectoryDealer[]): DealerFilterOptions {
  const states = new Set<string>();
  const brands = new Set<string>();
  const productTypes = new Set<string>();
  const services = new Set<string>();
  for (const d of dealers) {
    if (d.state && PARTICIPATING_STATES.includes(d.state)) states.add(d.state);
    d.brands.forEach((b) => brands.add(b));
    d.productTypes.forEach((t) => productTypes.add(t));
    d.services.forEach((s) => services.add(s));
  }
  const sorted = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  return {
    states: sorted(states),
    brands: sorted(brands),
    productTypes: sorted(productTypes),
    services: sorted(services),
  };
}

export type DealerFilters = {
  state?: string | null;
  brand?: string | null;
  productType?: string | null;
  service?: string | null;
  chips?: ChipKey[];
};

/** Narrows the dealer list by exact-match dropdown filters, then by every active chip (AND). */
export function applyFilters(
  dealers: DirectoryDealer[],
  filters: DealerFilters,
  nowMs: number,
): DirectoryDealer[] {
  const chips = filters.chips ?? [];
  return dealers.filter((d) => {
    if (filters.state && d.state !== filters.state) return false;
    if (filters.brand && !d.brands.includes(filters.brand)) return false;
    if (filters.productType && !d.productTypes.includes(filters.productType)) return false;
    if (filters.service && !d.services.includes(filters.service)) return false;
    return chips.every((chip) => CHIP_PREDICATES[chip](d, nowMs));
  });
}

export type SortKey = "distance" | "name";

// No "rating" sort — that data does not exist on the public dealer shape.
export const SORTS: Record<
  SortKey,
  (dealers: DirectoryDealer[], origin: [number, number] | null) => DirectoryDealer[]
> = {
  name: (dealers) => [...dealers].sort((a, b) => a.dealershipName.localeCompare(b.dealershipName)),
  distance: (dealers, origin) => {
    if (!origin) return dealers;
    return dealers
      .map((d) => {
        const point = dealerPoint(d);
        const km = point ? haversineKm(origin, point.coords) : Number.POSITIVE_INFINITY;
        return { d, km };
      })
      .sort((a, b) => a.km - b.km)
      .map((x) => x.d);
  },
};

/** True when the user's OS/browser requests reduced motion. Always false during SSR. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A search origin. `precise` is true only for the user's actual device position. */
export type DealerOrigin = { coords: [number, number]; label: string; precise: boolean };

/**
 * Resolves a typed location query to a `{ coords, label }` origin, purely
 * from data already on hand: a postcode centroid match first, then a
 * case-insensitive suburb match among the loaded dealers (using that
 * dealer's own postcode centroid). Never calls a network API — a Mapbox
 * geocoding fallback is a later task.
 *
 * Both paths deliberately stay on postcode centroids rather than per-dealer
 * geocodes: someone typing "Narellan" means the suburb, not one particular
 * dealer's front door. So these origins are always approximate.
 */
export function resolveOriginFromQuery(q: string, dealers: DirectoryDealer[]): DealerOrigin | null {
  const query = q.trim();
  if (!query) return null;

  const postcodeCoords = centroidFor(query);
  if (postcodeCoords) return { coords: postcodeCoords, label: query, precise: false };

  const lowerQuery = query.toLowerCase();
  const match = dealers.find((d) => d.suburb && d.suburb.toLowerCase() === lowerQuery);
  if (match) {
    const coords = centroidFor(match.postcode);
    if (coords) return { coords, label: match.suburb as string, precise: false };
  }

  return null;
}
