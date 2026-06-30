/**
 * buying-guide lifecycles
 *
 * Safeguard so every guide always has a usable slug. The `slug` uid field
 * auto-generates from `title` in the admin Content Manager, but that is an
 * admin-only convenience — a blank slug submitted via the Content/Document API
 * (or one an editor deliberately clears, now that slug is optional) would not be
 * filled in and would break the frontend route `/buying-guides/[slug]`.
 *
 * On create/update, when the slug is blank and a title is present, derive the
 * slug from the title. `strings.nameToSlug` produces the same kebab-case output
 * the admin uid generator uses. We never overwrite an existing/custom slug.
 */

import { strings } from '@strapi/utils';

type AnyRecord = Record<string, unknown>;

function ensureSlug(event: { params: { data: AnyRecord } }) {
  const { data } = event.params;
  const title = data.title;
  // Only generate when slug is blank AND a title is present in this payload.
  // beforeUpdate may receive a PARTIAL payload (e.g. only `excerpt`) with no title.
  const slugBlank = !data.slug || !String(data.slug).trim();
  if (slugBlank && typeof title === 'string' && title.trim()) {
    data.slug = strings.nameToSlug(title);
  }
}

export default {
  beforeCreate(event: { params: { data: AnyRecord } }) {
    ensureSlug(event);
  },
  beforeUpdate(event: { params: { data: AnyRecord } }) {
    ensureSlug(event);
  },
};
