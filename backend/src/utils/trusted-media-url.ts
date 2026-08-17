// All dealer media currently lives on this DigitalOcean Spaces host. `logo`
// and `photos` are free-text strings (not Strapi media relations) that end up
// directly in `<img src>` (public-dealer.ts) or fetched server-side by
// Caravea Connect (connect-registration.ts), so anything that isn't an https
// URL on this host is dropped rather than trusted.
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
// choose the image bytes rendered on our directory (or fetched by Connect).
// So pin bucket + root path too, derived from the same env the upload
// provider uses.
export const MEDIA_HOST = new URL(
  process.env.DO_SPACE_ENDPOINT || 'https://syd1.digitaloceanspaces.com'
).hostname;

export const MEDIA_PATH_PREFIX = `/${[
  process.env.DO_SPACE_BUCKET,
  process.env.DO_SPACE_ROOT_PATH,
]
  .filter(Boolean)
  .join('/')}/`;

export const isTrustedMediaUrl = (value: unknown): value is string => {
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
