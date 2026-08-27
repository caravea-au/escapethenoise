/**
 * Instant path for the site-wide enquiry-form switch.
 *
 * Same reasoning as the dealer lifecycle next door: staff will flip this and
 * immediately reload /find-dealer, and waiting out the frontend's 60 second
 * data-cache window gets reported as a bug. The switch is served inside the
 * meta of GET /api/dealers, so it sits under the SAME cache tag as the dealer
 * list and dropping that tag is all that is needed.
 *
 * Only create/update here, unlike the dealer lifecycle's three hooks. This is a
 * single type with draftAndPublish off, so there is no publish/unpublish to
 * arrive as a row delete, and nothing deletes the row in normal use.
 *
 * No `revalidateSuppressed()` check: that guard exists because the Connect sweep
 * writes up to one dealer row per sweep and would otherwise fire a ping each
 * time. Nothing writes this row except a human in the admin panel, so there is
 * no burst to suppress. The ping is fire-and-forget and never throws, so a dead
 * or unconfigured frontend cannot turn a successful save into an admin error.
 */

import { DEALERS_TAG, pingRevalidate } from '../../../../utils/revalidate-frontend';

function notifyFrontend(): void {
  // Deliberately not awaited: the caller is a DB lifecycle inside the admin's
  // save request, and an outbound HTTP call has no business holding that open.
  void pingRevalidate(strapi, DEALERS_TAG);
}

export default {
  afterCreate: notifyFrontend,
  afterUpdate: notifyFrontend,
};
