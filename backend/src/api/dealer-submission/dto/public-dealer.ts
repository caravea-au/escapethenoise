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
] as const;

export type PublicDealerField = (typeof PUBLIC_DEALER_FIELDS)[number];

export type PublicDealer = Record<PublicDealerField, unknown>;

// All dealer media currently lives on this DigitalOcean Spaces host. `logo`
// and `photos` are free-text strings (not Strapi media relations) that end up
// directly in `<img src>`, so anything that isn't an https URL on this host
// is dropped rather than trusted.
//
// Compare the parsed host EXACTLY. A `startsWith` prefix test would also accept
// `https://syd1.digitaloceanspaces.com.example.com/...`, which is an attacker's
// domain, not ours.
const MEDIA_HOST = 'syd1.digitaloceanspaces.com';

const isTrustedMediaUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === MEDIA_HOST;
  } catch {
    return false; // not a parseable absolute URL
  }
};

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
