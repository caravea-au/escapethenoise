/**
 * Sanitised, public shape of a `dealer` row.
 *
 * Moved here from `api/dealer-submission/dto/` when /find-dealer's source became
 * the Connect cache. The allow-list is the pre-swap one field for field and in
 * the same order, plus `approved` at the end — the one field the live Connect
 * read supplied out of band and this endpoint now has to carry itself. So
 * `DirectoryDealer` on the frontend does not change shape at all, which is what
 * leaves search, radius, the participating-states rule and the map camera
 * (ETN-005, ETN-008, ETN-012) untouched by this work.
 *
 * `toPublicDealer` builds a FRESH object by iterating this allow-list — it never
 * `delete`s keys off the row. A field added to the schema later is invisible here
 * until someone explicitly adds it below, rather than leaking by default. That
 * matters less on this collection than it did on `dealer-submission` (the mapper
 * never stores PII in the first place) but it is the property that makes it safe
 * to keep adding columns, so it stays.
 */

import { isTrustedMediaUrl } from '../../../utils/trusted-media-url';

export const PUBLIC_DEALER_FIELDS = [
  'documentId',
  'dealershipName',
  'street',
  'suburb',
  'state',
  'postcode',
  'phone',
  'website',
  'description',
  'logo',
  'photos',
  'facebook',
  'instagram',
  'youtube',
  'googleProfile',
  'tradingHours',
  'services',
  'servicesOther',
  'brands',
  'brandsOther',
  'productTypes',
  'productsOther',
  'stockCondition',
  'financeAvailable',
  'deliveryAvailable',
  'rvmapBadged',
  'rvmasterBadged',
  'established',
  'multipleLocations',
  'stateAssociation',
  // Map position. Appended LAST on purpose: this array's order is the JSON key
  // order of every dealer object, and keeping these three at the end is what
  // keeps the response byte-identical across the two source changes this
  // endpoint has now had.
  //
  // geocodeSource, matchedAddress and geocodedAddress must NOT be added. They
  // are `private` in the schema, and leaving them out of the SQL select below is
  // what keeps matchedAddress — raw upstream Nominatim text — inside SQLite.
  'latitude',
  'longitude',
  'precision',
  // Badge only (ETN-006). NOT a visibility gate: an unapproved dealer appears in
  // the directory and can be sent an enquiry (ETN-010). Visibility is the Strapi
  // publish toggle, enforced in the controller's `where`.
  'approved',
] as const;

export type PublicDealerField = (typeof PUBLIC_DEALER_FIELDS)[number];

export type PublicDealer = Record<PublicDealerField, unknown>;

/**
 * The columns the controller has to SELECT to be able to build the shape above.
 *
 * `documentId` is deliberately absent and `connectRef` takes its place: the id
 * this endpoint publishes as `documentId` is Connect's stable `reference`, not
 * the Strapi documentId of the cache row. Cards, map pins and the enquiry POST
 * all key on it, so it has to survive the cache being rebuilt from scratch — a
 * Strapi documentId would not, and every enquiry ever filed against a dealer
 * would lose its subject.
 */
export const DEALER_SELECT_FIELDS = [
  'connectRef',
  ...PUBLIC_DEALER_FIELDS.filter((field) => field !== 'documentId'),
] as string[];

/**
 * Constructs a sanitised public dealer object by allow-list. `row` may be
 * anything shaped like a `dealer` row (a raw `strapi.db.query` result); only the
 * fields named above are ever read from it.
 */
export function toPublicDealer(row: Record<string, unknown>): PublicDealer {
  const result = {} as PublicDealer;

  for (const field of PUBLIC_DEALER_FIELDS) {
    if (field === 'documentId') {
      result.documentId = row.connectRef ?? null;
      continue;
    }

    if (field === 'logo') {
      const logo = row.logo;
      result.logo = isTrustedMediaUrl(logo) ? logo : null;
      continue;
    }

    if (field === 'photos') {
      const photos = row.photos;
      result.photos = Array.isArray(photos) ? photos.filter(isTrustedMediaUrl) : [];
      continue;
    }

    // `approved` must never read as null on the frontend — the type is a plain
    // boolean and a null would render a badge for a dealer whose state we could
    // not read. Absent means not approved.
    if (field === 'approved') {
      result.approved = row.approved === true;
      continue;
    }

    result[field] = row[field] ?? null;
  }

  return result;
}
