/**
 * Instant path for the publish toggle.
 *
 * After ETN-013's D2 ruling (Connect owns every display field, Strapi owns only
 * the publication state) publishing and unpublishing is the ONLY human-facing
 * action left on a dealer. Staff will flip one and immediately reload
 * /find-dealer, so waiting out the frontend's 60 second data-cache window there
 * gets reported as a bug. This tells Next to drop the cached dealer list
 * straight away.
 *
 * WHY THESE THREE HOOKS. Strapi 5 implements draft/publish as separate rows in
 * the same table, so the publish/unpublish a human performs in the admin arrives
 * here as ordinary row events: publishing a dealer creates (or updates) their
 * published row, and unpublishing DELETES it. There is no `afterPublish` at this
 * layer to hook instead.
 *
 * The unavoidable consequence is that the sync's own writes land here too — up
 * to one per dealer per sweep. `revalidateSuppressed()` is what keeps a first
 * sweep of 180 dealers from firing 180 HTTP calls to invalidate a single tag;
 * the sync wraps its whole write phase in `withoutRevalidate`. The ping is
 * fire-and-forget and never throws, so a dead or unconfigured frontend can never
 * turn a successful publish into an error in the admin panel.
 */

import {
  DEALERS_TAG,
  pingRevalidate,
  revalidateSuppressed,
} from '../../../../utils/revalidate-frontend';

function notifyFrontend(): void {
  if (revalidateSuppressed()) return;
  // Deliberately not awaited: the caller is a DB lifecycle inside the admin's
  // save request, and an outbound HTTP call has no business holding that open.
  void pingRevalidate(strapi, DEALERS_TAG);
}

export default {
  afterCreate: notifyFrontend,
  afterUpdate: notifyFrontend,
  afterDelete: notifyFrontend,
};
