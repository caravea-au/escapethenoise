/**
 * connect routes
 *
 * Deliberately NOT `factories.createCoreRouter`. There is no content type here
 * to build a CRUD router over, and that is the point: this API owns no data
 * of its own — it is a manual re-push lever in front of Caravea Connect's
 * `/api/public/dealer-registrations`, backed by the same mapper the
 * dealer-submission lifecycle uses (see src/utils/connect-registration.ts).
 *
 * `config` is OMITTED ENTIRELY below, on purpose — same pattern as
 * `POST /geocode-address/resolve` in src/api/geocode/routes/geocode-address.ts.
 * With no `config`, Strapi falls back to its default auth, which requires a
 * valid API token (a `full-access` token; a `read-only` token is rejected by
 * the underlying permission check). Nothing is added to PUBLIC_ACTIONS in
 * src/index.ts, so the Public role never gets a permission row for this
 * action either.
 *
 * This route MUST stay in its own content-type-less `src/api/connect/`
 * folder rather than being hung off dealer-submission's controller.
 * `users-permissions.getActions()` walks every controller action in every
 * content type's API to build the Settings → Roles checkbox list; a push
 * action living on dealer-submission would render as a Public-role checkbox
 * directly beside `create` (already ticked for the public onboarding form),
 * one accidental "select all" away from becoming an unauthenticated relay
 * that posts arbitrary data into Connect using our shared key. A folder with
 * no content type has no such checkbox to tick.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/connect/push',
      handler: 'connect.push',
    },
  ],
};
