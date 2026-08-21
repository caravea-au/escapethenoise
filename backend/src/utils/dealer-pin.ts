/**
 * Validation for a dealer-supplied map pin.
 *
 * These coordinates arrive on a PUBLIC, unauthenticated endpoint
 * (POST /api/dealer-submissions), typed by whoever is filling in the onboarding
 * form — or by anyone with curl. Everything here is authoritative regardless of
 * what the client claims: the browser's own checks are a courtesy to honest
 * dealers, not a control.
 *
 * The pin is never a reason to reject a submission. A dealer losing their whole
 * onboarding form because a coordinate looked odd is far worse than a missing
 * pin, so bad input is dropped or downgraded, never fatal.
 */

// A byte-identical copy of frontend/src/lib/au-postcode-centroids.json. There
// are two copies on purpose: the backend must be self-contained to deploy (its
// build output cannot reach into the frontend workspace), and this is 2.3KB of
// static reference data that does not change — postcode centroids don't move.
// If you regenerate one, copy it to the other.
import centroids from './au-postcode-centroids.json';

// Mainland + Tasmania + the island territories that carry AU postcodes. A pin
// outside this box is not a dealership, it is a typo or a probe.
const AU_BOUNDS = { minLat: -44, maxLat: -9, minLng: 112, maxLng: 154 };

// Beyond this from the centroid of the postcode they typed, we keep the pin but
// stop believing it is street-accurate. Postcodes get very large inland, so this
// is deliberately loose.
const FAR_FROM_POSTCODE_KM = 25;

const MAX_ADDRESS_LENGTH = 300;

const EARTH_RADIUS_KM = 6371;

type Centroids = Record<string, [number, number]>;
const CENTROIDS = centroids as unknown as Centroids;

/**
 * Exactly the six coordinate attributes on dealer-submission. The controller
 * spreads this whole object into `data`, so the keys must stay in step with the
 * schema: Strapi's validateInput throws on any root key with no matching
 * attribute (it runs BEFORE sanitizeInput and ignores strictParams), so a key
 * here without a column 400s every pinned submission.
 */
export type DealerPinRow = {
  latitude: number;
  longitude: number;
  precision: 'street' | 'approx';
  /**
   * Narrower than the schema enum on purpose. The column also accepts
   * 'imported' and 'admin', but those describe provenance only the backend may
   * assert (the boot backfill, or a staff edit) — never a form submission.
   */
  geocodeSource: 'geocoded' | 'adjusted';
  matchedAddress: string;
  geocodedAddress: string;
};

/** Postcode -> `[lat, lng]` centroid. Mirrors the frontend's centroidFor so the two can't disagree. */
function centroidFor(postcode: unknown): [number, number] | null {
  // Coerce rather than reject non-strings. A bare `typeof !== 'string'` bail let
  // a caller skip the far-from-postcode precision downgrade entirely just by
  // sending `"postcode": 3000` as a JSON number instead of a string.
  if (postcode === null || postcode === undefined) return null;
  if (typeof postcode === 'object') return null;
  const trimmed = String(postcode).trim();
  if (!trimmed) return null;
  const key = /^\d+$/.test(trimmed) ? trimmed.padStart(4, '0') : trimmed;
  return CENTROIDS[key] ?? null;
}

/** Great-circle distance between two `[lat, lng]` points, in kilometres. */
function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Exported so every path that stores an address string uses this one sanitiser,
 * including the boot backfill, whose input is a committed file rather than a
 * request. That file is trusted today; the point is that it does not have to be.
 */
export const cleanAddress = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return (
    value
      // Slice BEFORE the regex passes. Regexing an unbounded string and only
      // then truncating to 300 chars let a large payload burn event-loop time
      // on every other API route — Strapi is single-threaded.
      .slice(0, MAX_ADDRESS_LENGTH * 4)
      .replace(/\p{C}/gu, ' ')
      .replace(/\s+/g, ' ')
      // Angle brackets encoded for the same reason encodeAngles exists for the
      // rest of the payload: no stored value should be parseable as HTML by a
      // future consumer. These two fields now also pass THROUGH encodeAngles
      // (the validated pin is merged into `data` before that call), which is
      // harmless — encodeAngles rewrites only `<` and `>`, never `&`, so it is a
      // no-op on output that is already `&lt;`. Kept here rather than deleted so
      // this stays correct if the merge order ever moves back. Not reachable
      // today (neither field is in the public dealer allow-list, both are `private`, and
      // the frontend never renders them), which is exactly why it would be easy
      // to expose later by accident.
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Leading =, +, - or @ makes a spreadsheet treat the cell as a formula on
      // CSV export. Prefix a quote to neutralise it.
      .replace(/^([=+\-@])/, "'$1")
      .trim()
      .slice(0, MAX_ADDRESS_LENGTH)
  );
};

/**
 * Turns whatever arrived in `data.pin` into a row we are willing to store, or
 * null if it is unusable.
 *
 * `postcode` is the one the dealer typed into the form, used to sanity-check
 * the coordinates against each other.
 */
export function validateDealerPin(
  raw: unknown,
  postcode: unknown,
): DealerPinRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const pin = raw as Record<string, unknown>;

  const lat = Number(pin.lat);
  const lng = Number(pin.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < AU_BOUNDS.minLat || lat > AU_BOUNDS.maxLat) return null;
  if (lng < AU_BOUNDS.minLng || lng > AU_BOUNDS.maxLng) return null;

  // Never trust a client-supplied source. `imported` and `admin` describe
  // provenance only this backend can assert (the boot backfill, or a staff
  // edit); a form submission is one of exactly two things.
  const geocodeSource: DealerPinRow['geocodeSource'] =
    pin.source === 'adjusted' ? 'adjusted' : 'geocoded';

  let precision: DealerPinRow['precision'] =
    pin.precision === 'street' ? 'street' : 'approx';

  // A pin nowhere near the postcode they typed may still be genuine (a big
  // rural postcode, or a dealer who dragged it to a back entrance on a
  // neighbouring road), so store it — but stop claiming street accuracy, which
  // is what makes /find-dealer quote a distance without a "~".
  const centroid = centroidFor(postcode);
  if (centroid && haversineKm([lat, lng], centroid) > FAR_FROM_POSTCODE_KM) {
    precision = 'approx';
  }

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    precision,
    geocodeSource,
    matchedAddress: cleanAddress(pin.matchedAddress),
    geocodedAddress: cleanAddress(pin.geocodedAddress),
  };
}
