import type { Core } from "@strapi/strapi";

// Public read actions the frontend relies on (it queries these without a token).
const PUBLIC_ACTIONS = [
  "api::buying-guide.buying-guide.find",
  "api::buying-guide.buying-guide.findOne",
  "api::vehicle-listing.vehicle-listing.find",
  "api::vehicle-listing.vehicle-listing.findOne",
  "api::header.header.find",
  "api::footer.footer.find",
  "api::home-page.home-page.find",
  "api::privacy-policy.privacy-policy.find",
  // Dealer onboarding form posts here (no token); needs upload for logo/photos.
  "api::dealer-submission.dealer-submission.create",
  "plugin::upload.content-api.upload",
];

export default {
  register() {},

  // Ensure the Public role can read the content the frontend needs. Permissions
  // live in the DB (not in code), so a fresh deploy — e.g. the live server —
  // won't have them. This grants them idempotently on every boot.
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const publicRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });
    if (!publicRole) return;

    for (const action of PUBLIC_ACTIONS) {
      const existing = await strapi
        .query("plugin::users-permissions.permission")
        .findOne({ where: { action, role: publicRole.id } });
      if (!existing) {
        await strapi
          .query("plugin::users-permissions.permission")
          .create({ data: { action, role: publicRole.id } });
        strapi.log.info(`[bootstrap] granted Public role: ${action}`);
      }
    }
  },
};
