/**
 * smtp-setting controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::smtp-setting.smtp-setting',
  () => ({
    /**
     * Public, sanitized reCAPTCHA config for the frontend. Returns ONLY the
     * (public) site key, the enabled flag, and the support email shown to
     * dealers whose browser blocks the spam check — never the secret key or any
     * SMTP credential. The core find route is left non-public for that reason.
     */
    async getRecaptchaConfig(ctx) {
      const cfg = (await strapi
        .documents('api::smtp-setting.smtp-setting')
        .findFirst()) as Record<string, unknown> | null;

      const supportEmail = (cfg?.supportEmail as string) ?? '';

      ctx.body = {
        enabled: cfg?.recaptchaEnabled === true,
        siteKey: (cfg?.recaptchaSiteKey as string) ?? null,
        supportEmail: supportEmail.trim() || null,
      };
    },
  }),
);
