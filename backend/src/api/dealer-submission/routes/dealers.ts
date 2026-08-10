/**
 * Public, sanitised dealer directory routes. Kept separate from the core
 * `dealer-submission` router (routes/dealer-submission.ts), which stays
 * private — only these two custom actions are ever exposed publicly.
 *
 * `/dealer-counts` (not `/dealers/counts`) so it never depends on route
 * registration order against a future `/dealers/:key` route.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/dealers',
      handler: 'dealer-submission.findPublic',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/dealer-counts',
      handler: 'dealer-submission.stateCounts',
      config: {
        auth: false,
      },
    },
  ],
};
