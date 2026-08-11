/**
 * dealer-geocode routes
 *
 * Deliberately NOT `factories.createCoreRouter`, following dealer-enquiry's
 * reasoning: a core router would also wire up find/findOne/update/delete, and a
 * single future permissions tick on the Public role would hand the internet
 * write access to every dealer's map position. Staff still edit these rows
 * normally through the admin panel, which uses the content-manager API and does
 * not depend on these routes existing.
 *
 * `/geocode-address` is a verb, not a collection, so it stays off the
 * `/dealer-geocodes` prefix — same reasoning as `/dealer-counts` living outside
 * `/dealers`: it can never collide with a future `/dealer-geocodes/:id` route.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/geocode-address',
      handler: 'dealer-geocode.geocodeAddress',
      config: {
        auth: false,
      },
    },
    {
      // No `auth: false`, so Strapi requires a valid API token. Used by
      // scripts/geocode-dealers.mjs to fill gaps without tripping the public
      // per-IP limit.
      method: 'POST',
      path: '/dealer-geocodes/resolve',
      handler: 'dealer-geocode.resolveAddress',
    },
  ],
};
