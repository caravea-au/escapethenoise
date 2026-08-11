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

// All dealer media currently lives on this DigitalOcean Spaces host. `logo`
// and `photos` are free-text strings (not Strapi media relations) that end up
// directly in `<img src>`, so anything that isn't an https URL on this host
// is dropped rather than trusted.
//
// Compare the parsed host EXACTLY. A `startsWith` prefix test would also accept
// `https://syd1.digitaloceanspaces.com.example.com/...`, which is an attacker's
// domain, not ours.
//
// The host alone is NOT sufficient: `syd1.digitaloceanspaces.com` is
// DigitalOcean's shared regional endpoint, used by every Spaces customer in
// that region, and real URLs are path-style
// (https://<host>/<bucket>/<rootPath>/file.jpg). Without the path check,
// anyone with a syd1 Space could point `logo`/`photos` at their own bucket and
// choose the image bytes rendered on our directory. So pin bucket + root path
// too, derived from the same env the upload provider uses.
const MEDIA_HOST = new URL(
  process.env.DO_SPACE_ENDPOINT || 'https://syd1.digitaloceanspaces.com'
).hostname;

const MEDIA_PATH_PREFIX = `/${[
  process.env.DO_SPACE_BUCKET,
  process.env.DO_SPACE_ROOT_PATH,
]
  .filter(Boolean)
  .join('/')}/`;

const isTrustedMediaUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === MEDIA_HOST &&
      url.pathname.startsWith(MEDIA_PATH_PREFIX)
    );
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
