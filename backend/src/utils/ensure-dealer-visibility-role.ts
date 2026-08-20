/**
 * The "Dealer Visibility" admin role: publish and unpublish dealers, edit nothing.
 *
 * WHY IT IS IN CODE. Admin roles live in the database, not in the repo, so
 * without this the rule would be a manual click-path that has to be remembered
 * once per environment and silently isn't. Same reasoning as the Public-role
 * grants in src/index.ts, and the same shape: idempotent, additive, never throws.
 *
 * WHAT IT ENFORCES. ETN-013 D2 ruled that staff may publish and draft a dealer
 * but not edit their content — Connect owns every display field and the sync
 * overwrites it freely, so an edit made here reverts within one cron interval and
 * looks like data loss to whoever made it. Until now that was enforced only by
 * the sync winning. This makes the admin API refuse it: granting `read` and
 * `publish` while withholding `update` renders the form read-only and leaves the
 * publish/unpublish buttons working. Measured on Strapi 5.40 Community:
 *
 *   read 200 · publish 200 · unpublish 200 · update 403 · delete 403
 *
 * WHAT IT DOES NOT DO. Super Admins keep full access, deliberately — someone has
 * to be able to fix a broken row. That is a small hole: a manual edit by a Super
 * Admin is overwritten by the next sweep anyway, so it is self-healing rather
 * than a data-integrity problem.
 *
 * Assigning people to the role is still a human decision, in
 * Settings → Administration Panel → Users.
 */

import type { Core } from '@strapi/strapi';

import dealerSchema from '../api/dealer/content-types/dealer/schema.json';

const ROLE_CODE = 'dealer-visibility';
const ROLE_NAME = 'Dealer Visibility';
const ROLE_DESCRIPTION =
  'Publish and unpublish dealers in the directory. Cannot edit dealer content: ' +
  'Caravea Connect owns every field and the sync overwrites local edits.';

const DEALER_UID = 'api::dealer.dealer';
const ACTION_READ = 'plugin::content-manager.explorer.read';
const ACTION_PUBLISH = 'plugin::content-manager.explorer.publish';

/**
 * Every attribute the role may READ, taken from the schema file itself so the
 * list cannot drift as fields are added. Strapi scopes `read` by field, and a
 * field missing here is invisible in the panel — which for this role would mean
 * staff hiding a dealer they cannot see the address of.
 *
 * A flat list is correct only because `dealer` is all scalars; relations and
 * components need dotted paths, so revisit this if either is ever added.
 */
const readableFields = (): string[] => Object.keys(dealerSchema.attributes);

export async function ensureDealerVisibilityRole(strapi: Core.Strapi): Promise<void> {
  try {
    let role = (await strapi.db.query('admin::role').findOne({
      where: { code: ROLE_CODE },
    })) as { id: number } | null;

    if (!role) {
      // A stable `code`, unlike the random suffix Strapi's own role-creation
      // endpoint generates (`dealer-visibility-mt24k7ox`) — this has to be
      // findable on the next boot, or every restart would add another role.
      role = (await strapi.db.query('admin::role').create({
        data: { name: ROLE_NAME, code: ROLE_CODE, description: ROLE_DESCRIPTION },
      })) as { id: number };
      strapi.log.info(`[bootstrap] created admin role "${ROLE_NAME}"`);
    }

    const grants: { action: string; properties: Record<string, unknown> }[] = [
      { action: ACTION_READ, properties: { fields: readableFields() } },
      { action: ACTION_PUBLISH, properties: {} },
    ];

    for (const { action, properties } of grants) {
      const existing = await strapi.db.query('admin::permission').findOne({
        where: { action, subject: DEALER_UID, role: role.id },
      });
      // Additive only. If someone deliberately grants `update` on top of this in
      // the panel, that is their call and this must not silently undo it — the
      // same contract as the Public-role loop in src/index.ts, which only ever
      // grants what is missing.
      if (existing) continue;

      await strapi.db.query('admin::permission').create({
        data: {
          action,
          actionParameters: {},
          subject: DEALER_UID,
          properties,
          conditions: [],
          role: role.id,
        },
      });
      strapi.log.info(`[bootstrap] granted "${ROLE_NAME}": ${action}`);
    }
  } catch (error) {
    // Never fail boot over a permissions convenience. The worst case without
    // this role is the pre-ETN-013 behaviour: fields are editable and the sync
    // overwrites them.
    strapi.log.warn(
      `[bootstrap] could not ensure the "${ROLE_NAME}" role: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
