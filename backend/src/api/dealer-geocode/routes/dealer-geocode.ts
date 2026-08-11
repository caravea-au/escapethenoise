/**
 * dealer-geocode core router — CRUD for scripts holding an API token.
 *
 * Unlike dealer-enquiry (which refuses a core router because its rows are
 * consumer PII), a core router is fine here: these rows hold nothing but map
 * coordinates, which are already published on /find-dealer via /api/dealers.
 * The risk worth guarding is WRITE access, and every action below inherits
 * Strapi's default `auth: true`, so a valid API token is required. Nothing here
 * is listed in PUBLIC_ACTIONS in src/index.ts, so the Public role cannot reach
 * any of it.
 *
 * If you ever need a public read of these rows, add it to the dealer merge in
 * dealer-submission's `findPublic` instead of opening `find` to the Public role.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter(
  'api::dealer-geocode.dealer-geocode',
);
