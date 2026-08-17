/**
 * Sanitised, public shape of a dealer-submission row.
 *
 * `dealer-submission` is a stand-in collection that also stores the
 * dealership's private onboarding data (ABN, licence numbers, submitter
 * contact details, consents, spam flags...). None of that may ever reach a
 * public response.
 *
 * `toPublicDealer` builds a FRESH object by iterating this allow-list —
 * it never `delete`s keys off the row. That means a field added to the
 * schema later is invisible here until someone explicitly adds it to
 * `PUBLIC_DEALER_FIELDS` below, rather than leaking by default.
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
  // Map position, published on /find-dealer. Appended LAST on purpose: this
  // array's order is the JSON key order of every dealer object, and these three
  // used to be merged on after the fact, so keeping them at the end leaves the
  // public response byte-identical to before the coordinates moved collection.
  //
  // The other three coordinate columns — geocodeSource, matchedAddress,
  // geocodedAddress — must NOT be added here. This array is also the SQL
  // `select`, so leaving them out is what keeps them inside SQLite.
  'latitude',
  'longitude',
  'precision',
] as const;

export type PublicDealerField = (typeof PUBLIC_DEALER_FIELDS)[number];

export type PublicDealer = Record<PublicDealerField, unknown>;

/**
 * Constructs a sanitised public dealer object by allow-list. `row` may be
 * anything shaped like a dealer-submission row (a raw `strapi.db.query`
 * result); only fields named in `PUBLIC_DEALER_FIELDS` are ever read from it.
 */
export function toPublicDealer(row: Record<string, unknown>): PublicDealer {
  const result = {} as PublicDealer;

  for (const field of PUBLIC_DEALER_FIELDS) {
    if (field === 'logo') {
      const logo = row.logo;
      result.logo = isTrustedMediaUrl(logo) ? logo : null;
      continue;
    }

    if (field === 'photos') {
      const photos = row.photos;
      result.photos = Array.isArray(photos)
        ? photos.filter(isTrustedMediaUrl)
        : [];
      continue;
    }

    result[field] = row[field] ?? null;
  }

  return result;
}
