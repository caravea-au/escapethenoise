// Resolves a typed postcode / suburb query to a search origin, from a full
// Australian locality dataset held on the server.
//
// SERVER ONLY, and the `server-only` import is the enforcement, not a comment:
// `au-localities.json` is ~768KB (~235KB gzipped) and must never reach the
// browser. The directory island (DealerDirectory) is a client component, so the
// resolution happens in find-dealer/page.tsx and only the resolved
// `{ coords, label }` crosses the boundary. Importing this file from a
// "use client" module is a build error, by design.
//
// ATTRIBUTION: `au-localities.json` is derived from the GeoNames postal-code
// export for Australia (https://download.geonames.org/export/zip/AU.zip),
// licensed CC BY 4.0. The licence is satisfied by crediting GeoNames with a
// link wherever the data is shown — see the map legend in DealerMap.tsx, which
// already carries the Mapbox/OpenStreetMap credits for the dealer geocodes.
// This dataset is separate from `au-postcode-centroids.json` (Nominatim/ODbL),
// which still positions dealers who have no coordinates of their own and is
// deliberately left alone.
import "server-only";

import data from "@/lib/au-localities.json";
import type { DealerOrigin } from "@/lib/dealers";

type LocalityRow = [name: string, state: string, lat: number, lng: number, postcodeCount: number];
type Dataset = {
  /** Postcode → `[lat, lng]`, the component-wise median of every locality row in that postcode. */
  postcodes: Record<string, [number, number]>;
  /** One row per (locality name, state), coordinates median across its postcodes. */
  localities: LocalityRow[];
};

const DATA = data as unknown as Dataset;

/**
 * The shortest query we will prefix-match on. Two characters matches hundreds
 * of localities ("a" alone matches 581 rows), which resolves to somewhere
 * essentially arbitrary — worse for the user than an honest miss. Exact matches
 * are still allowed at any length; no locality in the dataset normalises to
 * fewer than 3 characters, so nothing is lost.
 */
const MIN_PREFIX_LENGTH = 3;

/**
 * Lowercase, whitespace collapsed, punctuation to spaces — but apostrophes are
 * DELETED rather than spaced, because the dataset writes these names without
 * one ("St Marys", "OConnor") while people type them with one. Spacing the
 * apostrophe instead would turn "St Mary's" into "st mary s", which matches
 * neither exactly nor by prefix.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Built once per server process, from the shipped rows.
let localityIndex: { key: string; row: LocalityRow }[] | null = null;
function index() {
  localityIndex ??= DATA.localities.map((row) => ({ key: normalise(row[0]), row }));
  return localityIndex;
}

/** Postcode → `[lat, lng]`, padding short numeric codes ("829" → "0829") the way `centroidFor` does. */
function postcodeCoords(query: string): [number, number] | null {
  if (!/^\d{1,4}$/.test(query)) return null;
  return DATA.postcodes[query.padStart(4, "0")] ?? null;
}

/**
 * Best locality match for a query, or null.
 *
 * Ranking, in order: an exact normalised name beats a prefix match; then the
 * (name, state) group covering the most postcodes, which is the dataset's own
 * proxy for how big a place is (Sydney NSW spans 148 postcodes, Geelong VIC
 * one — so "syd" resolves to Sydney rather than to a hamlet); then the shortest
 * name; then alphabetically by state and name, so the result is deterministic.
 */
function localityMatch(query: string): LocalityRow | null {
  const q = normalise(query);
  if (!q) return null;

  const candidates: { row: LocalityRow; exact: boolean }[] = [];
  for (const { key, row } of index()) {
    if (key === q) candidates.push({ row, exact: true });
    else if (q.length >= MIN_PREFIX_LENGTH && key.startsWith(q)) candidates.push({ row, exact: false });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.row[4] !== b.row[4]) return b.row[4] - a.row[4];
    if (a.row[0].length !== b.row[0].length) return a.row[0].length - b.row[0].length;
    return a.row[1].localeCompare(b.row[1]) || a.row[0].localeCompare(b.row[0]);
  });
  return candidates[0].row;
}

/**
 * Resolves a typed location query to a search origin. Postcodes first (a bare
 * 4-digit query is never a suburb name), then a normalised locality match.
 *
 * Origins are never `precise`: a postcode resolves to the median of its
 * localities and a locality to the median of its postcodes, so distances keep
 * their "~" (see `formatDistance`). Only the user's own GPS fix is precise.
 *
 * Returns null for a genuine miss ("asdfgh") — the caller shows the
 * "couldn't find that location" notice, which is a real state worth keeping.
 */
export function resolveLocationQuery(query: string): DealerOrigin | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const byPostcode = postcodeCoords(trimmed);
  if (byPostcode) return { coords: byPostcode, label: trimmed, precise: false };

  const row = localityMatch(trimmed);
  if (row) return { coords: [row[2], row[3]], label: `${row[0]}, ${row[1]}`, precise: false };

  return null;
}
