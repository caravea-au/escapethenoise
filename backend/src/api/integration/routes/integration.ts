/**
 * integration routes
 *
 * `config` is OMITTED ENTIRELY below, on purpose — same pattern as
 * `POST /connect/push` and `POST /geocode-address/resolve`. With no `config`,
 * Strapi falls back to its default auth, which requires a valid full-access API
 * token. There is no `auth: false` here and there must never be: this triggers a
 * full outbound read of Connect's dealer feed and writes to every dealer row.
 *
 * This route MUST stay in its own content-type-less `src/api/integration/`
 * folder rather than being hung off the `dealer` controller.
 * `users-permissions.getActions()` walks every controller action of every
 * content type's API to build the Settings → Roles checkbox list, so a sync
 * action living on `dealer` would render as a Public-role checkbox one
 * accidental "select all" away from becoming an unauthenticated way to drive
 * traffic at Connect using our shared key. A folder with no content type has no
 * such checkbox to tick.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/integrations/dealers/sync',
      handler: 'integration.syncDealers',
    },
  ],
};
