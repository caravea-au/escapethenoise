/**
 * Recursively HTML-entity-encodes `<`/`>` in strings (and inside arrays/objects),
 * leaving numbers/booleans untouched. LOSSLESS: legitimate copy like
 * "vans < 3.5 tonne" survives, while "<script>" becomes inert "&lt;script&gt;".
 *
 * Extracted from dealer-submission's controller so dealer-enquiry can reuse the
 * exact same behaviour without a second implementation.
 *
 * NOTE: no SQL-keyword filtering — Strapi parameterizes all queries (SQLite
 * here), and stripping keywords would corrupt legitimate values like a
 * dealership named "Select Caravans".
 */
export const encodeAngles = (v: unknown): unknown =>
  typeof v === 'string'
    ? v.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : Array.isArray(v)
      ? v.map(encodeAngles)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v).map(([k, x]) => [k, encodeAngles(x)]),
          )
        : v;
