/**
 * Sanitised, public shape of a `dealer` row.
 *
 * Moved here from `api/dealer-submission/dto/` when /find-dealer's source became
 * the Connect cache. The allow-list is the pre-swap one field for field and in
 * the same order, then two appended booleans: `approved` (the badge the live
 * Connect read used to supply out of band) and `hasCaraveaCompanyId` (the
 * ETN-017 enquiry gate). Everything search, radius, the participating-states
 * rule and the map camera read (ETN-005, ETN-008, ETN-012) is untouched by
 * either, which is why none of them has had to move for any of this.
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
  // Badge only (ETN-006). NOT a visibility gate: an unapproved dealer still
  // appears in the directory. Visibility is the Strapi publish toggle, enforced
  // in the controller's `where`. Deliberately not the enquiry gate either, even
  // though it happens to agree with one today. See `hasCaraveaCompanyId`.
  'approved',
  // Whether Connect has issued this dealer a `caravea_company_id`. This is the
  // per-dealer enquiry gate (ETN-017), and it is published as a DERIVED BOOLEAN
  // and never as the id itself: ETN-016 deliberately keeps `caraveaCompanyId`
  // server-side only (it is `private` in the schema and is absent from this
  // allow-list), and the page only ever needs the yes/no. Appended last for the
  // same reason the coordinates were: this array is the JSON key order of every
  // dealer object, so anything new goes on the end.
  'hasCaraveaCompanyId',
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
  // Selected so `hasCaraveaCompanyId` can be derived from it, NEVER published.
  // The allow-list above is the whole of what reaches the response and the raw
  // id is not on it, so this column stays inside SQLite exactly as
  // matchedAddress does.
  'caraveaCompanyId',
  ...PUBLIC_DEALER_FIELDS.filter(
    (field) => field !== 'documentId' && field !== 'hasCaraveaCompanyId',
  ),
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

    // Same fail-closed shape as `approved`, for a stronger reason: this one
    // decides whether an enquiry form is offered at all, so a dealer whose id
    // we could not read has to answer "no id" and get no form, rather than be
    // offered one we could not attribute to a Connect company. A blank or
    // whitespace-only string counts as no id, the same normalisation
    // fetchCachedDealer applies, which is what keeps the page and the POST
    // agreeing about the same dealer.
    if (field === 'hasCaraveaCompanyId') {
      const id = row.caraveaCompanyId;
      result.hasCaraveaCompanyId = typeof id === 'string' && id.trim().length > 0;
      continue;
    }

    result[field] = row[field] ?? null;
  }

  return result;
}
