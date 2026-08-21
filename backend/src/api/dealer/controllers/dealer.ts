/**
 * dealer controller — the public dealer directory read.
 *
 * Two custom actions and NOTHING ELSE. Deliberately not
 * `factories.createCoreController`, and there is deliberately no
 * `routes/dealer.ts` calling `createCoreRouter`: a core router on this content
 * type would register its own `GET /api/dealers` (the plural name is `dealers`)
 * straight on top of the sanitised route in `routes/dealers.ts`, and whichever
 * won would be decided by registration order. Only the two actions below are
 * ever exposed.
 *
 * ONE gate, applied in both actions: `publishedAt` must be set. That is the
 * whole publication feature — a dealer a staff member unpublishes in the admin
 * leaves the cards, the subtitle count, the state tiles, the map markers and the
 * filter dropdown at once, because every one of those is derived on the frontend
 * from this single response.
 */

import { factories } from '@strapi/strapi';
import { DEALER_SELECT_FIELDS, toPublicDealer } from '../dto/public-dealer';

const DEALER_UID = 'api::dealer.dealer';

/**
 * Published-only, and the reason it has to be spelled out: `strapi.db.query` is
 * the raw query layer, so it does NOT apply Strapi's publication scoping. A
 * draftAndPublish collection keeps the draft AND the published entry of each
 * document as separate rows in one table, so without this filter the response
 * would carry every hidden dealer AND a duplicate of every visible one.
 */
const PUBLISHED_ONLY = { publishedAt: { $notNull: true } };

export default factories.createCoreController(DEALER_UID, () => ({
  /**
   * Public, sanitised dealer directory listing.
   *
   * Bypasses the core find/document-service entirely, for the same two reasons
   * this endpoint always has: `config/api.ts` caps `maxLimit` at 100 and there
   * are more dealers than that, and the core controller cannot select an
   * allow-list of fields at the DB layer — private columns would still be read
   * out of SQLite even if stripped afterwards. `strapi.db.query` takes a
   * `select`, so they never leave the file.
   */
  async findPublic(ctx) {
    const rows = await strapi.db.query(DEALER_UID).findMany({
      select: DEALER_SELECT_FIELDS,
      where: PUBLISHED_ONLY,
      orderBy: [{ state: 'asc' }, { dealershipName: 'asc' }],
    });

    // toPublicDealer's `row[field] ?? null` gives the explicit nulls the frontend
    // depends on: it always sees the same shape, and a dealer with no coordinate
    // falls back to their postcode centroid in dealerPoint().
    const data = (rows as Record<string, unknown>[]).map(toPublicDealer);

    ctx.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    ctx.body = { data, meta: { total: data.length } };
  },

  /**
   * Public dealer counts per state.
   *
   * Route is `/dealer-counts` (not `/dealers/counts`) so it never depends on
   * route-registration order against a future `/dealers/:key`.
   *
   * NOTE: /find-dealer does not call this. The page derives its tile counts from
   * the very list it renders, so a tile can never advertise a count the page it
   * links to cannot produce. Kept because it is a public contract that has
   * always been here, and because the counts it returns now agree with the list
   * again — both are published-only off the same table.
   */
  async stateCounts(ctx) {
    const rows = await strapi.db.query(DEALER_UID).findMany({
      select: ['state'],
      where: PUBLISHED_ONLY,
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of rows as { state?: string | null }[]) {
      if (!row.state) continue;
      counts[row.state] = (counts[row.state] ?? 0) + 1;
      total += 1;
    }

    ctx.set('Cache-Control', 'public, max-age=300');
    ctx.body = { data: counts, meta: { total } };
  },
}));
