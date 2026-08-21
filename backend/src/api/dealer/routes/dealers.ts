/**
 * Public, sanitised dealer directory routes.
 *
 * Moved here from `api/dealer-submission/routes/` with ETN-013: the paths and
 * their responses are unchanged, only the table behind them moved from
 * `dealer_submissions` to the Connect cache. Nothing on the frontend had to
 * learn a new URL.
 *
 * `/dealer-counts` (not `/dealers/counts`) so it never depends on route
 * registration order against a future `/dealers/:key` route.
 *
 * There is NO `routes/dealer.ts` with `createCoreRouter` in this folder, and
 * there must not be: it would register its own CRUD `GET /api/dealers` on top of
 * the sanitised one below (the content type's plural name is `dealers`), and
 * expose unfiltered draft rows through the core find action.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/dealers',
      handler: 'dealer.findPublic',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/dealer-counts',
      handler: 'dealer.stateCounts',
      config: {
        auth: false,
      },
    },
  ],
};
