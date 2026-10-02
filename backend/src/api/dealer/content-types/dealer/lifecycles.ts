/**
 * Instant path for the publish toggle, and the ETN-019 marker handover.
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
 * `autoHiddenAt` is non-null only when THE SYNC hid the card. A human publish or
 * unpublish clears it: from that moment a human owns the publish state, so the
 * sync must neither auto-return what it did not hide nor keep re-arming a hide
 * the human reversed (a manual republish while the feed says suspended relies on
 * this to re-arm). A publish event is recognised by the written row carrying a
 * non-null `publishedAt`; the unpublish path is `afterDelete`, which is how the
 * published row's removal arrives. The clear is gated on the same suppression
 * flag the pings use, so the sync's own writes never clear the marker they are
 * in the middle of setting.
 *
 * Known, inherited gap (revalidate-frontend.ts:42-46): a human publish or
 * unpublish DURING a sweep is suppressed too, so its marker clear and its ping
 * are both skipped. The publish state is still read correctly on the next
 * sweep's fresh cache read, and the ping falls back to the 60 second cache
 * window, the pre-ETN-013 behaviour.
 *
 * The sync's own writes land here too, up to one per dealer per sweep.
 * `revalidateSuppressed()` is what keeps a first sweep of 180 dealers from
 * firing 180 HTTP calls to invalidate a single tag; the sync wraps its whole
 * write phase in `withoutRevalidate`. The ping is fire-and-forget and never
 * throws, so a dead or unconfigured frontend can never turn a successful publish
 * into an error in the admin panel.
 */

import {
  DEALERS_TAG,
  pingRevalidate,
  revalidateSuppressed,
} from '../../../../utils/revalidate-frontend';

type AnyRecord = Record<string, unknown>;

function notifyFrontend(): void {
  if (revalidateSuppressed()) return;
  // Deliberately not awaited: the caller is a DB lifecycle inside the admin's
  // save request, and an outbound HTTP call has no business holding that open.
  void pingRevalidate(strapi, DEALERS_TAG);
}

/**
 * Fire-and-forget marker clear. `strapi.db.query` rather than the document
 * service, so it cannot re-enter the document lifecycles and recurse, and never
 * awaited: failing to clear the marker must never fail the admin action that
 * caused it.
 */
function clearAutoHidden(documentId: string): void {
  void strapi.db
    .query('api::dealer.dealer')
    .update({ where: { documentId }, data: { autoHiddenAt: null } })
    .catch((error: unknown) => {
      strapi.log.warn(
        `[dealer-lifecycles] could not clear autoHiddenAt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
}

/** Human create/update: a non-null `publishedAt` on the written row is a publish event. */
function onWrite(event: { result: AnyRecord }): void {
  if (revalidateSuppressed()) return;
  const documentId = typeof event.result.documentId === 'string' ? event.result.documentId : null;
  if (documentId && event.result.publishedAt) clearAutoHidden(documentId);
  notifyFrontend();
}

/** Human delete: the unpublish path, so the marker handover is unconditional. */
function onDelete(event: { result: AnyRecord }): void {
  if (revalidateSuppressed()) return;
  const documentId = typeof event.result.documentId === 'string' ? event.result.documentId : null;
  if (documentId) clearAutoHidden(documentId);
  notifyFrontend();
}

export default {
  afterCreate: onWrite,
  afterUpdate: onWrite,
  afterDelete: onDelete,
};
