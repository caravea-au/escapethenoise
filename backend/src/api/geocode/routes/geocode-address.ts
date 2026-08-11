/**
 * geocode routes
 *
 * Deliberately NOT `factories.createCoreRouter`. There is no content type here
 * to build a CRUD router over, and that is the point: this API owns no data, so
 * there is nothing a future permissions tick on the Public role could hand the
 * internet write access to.
 *
 * `/geocode-address` is a verb, not a collection. The path is UNCHANGED from
 * when these handlers lived under `api/dealer-geocode` — the deployed onboarding
 * form calls it directly (frontend LocationPin.tsx), so it is a public contract.
 * Only the resolve route moved, from `/dealer-geocodes/resolve`, because the
 * collection that prefix named no longer exists.
 *
 * The handler strings must match the API FOLDER name, not the URL path. Strapi
 * resolves `geocode.geocodeAddress` to `api::geocode.geocode` using the folder
 * this file sits in; leaving them as `dealer-geocode.*` after the move would
 * resolve to a controller that no longer exists and fail at boot with
 * "Handler not found".
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/geocode-address',
      handler: 'geocode.geocodeAddress',
      config: {
        // Public and unauthenticated, which is why the controller rate-limits
        // per IP. `auth: false` is sufficient on its own — it bypasses the
        // users-permissions policy, so no Public-role permission row is needed
        // and there is nothing to add to PUBLIC_ACTIONS in src/index.ts.
        auth: false,
      },
    },
    {
      // No `auth: false`, so Strapi requires a valid API token. Used by
      // scripts/geocode-dealers.mjs to fill gaps without tripping the public
      // per-IP limit.
      method: 'POST',
      path: '/geocode-address/resolve',
      handler: 'geocode.resolveAddress',
    },
  ],
};
