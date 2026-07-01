/**
 * dealer-submission controller
 *
 * Overrides `create` to verify a Google reCAPTCHA v3 token before saving.
 * The site/secret keys live in the "SMTP Settings" single type; verification
 * is skipped entirely when reCAPTCHA is disabled there.
 */

import { factories } from '@strapi/strapi';

// Minimum v3 score (0.0–1.0) we accept. Google suggests 0.5 as a default.
const MIN_SCORE = 0.5;

export default factories.createCoreController(
  'api::dealer-submission.dealer-submission',
  () => ({
    async create(ctx) {
      const body = ctx.request.body as { data?: Record<string, unknown> };
      const token =
        typeof body?.data?.recaptchaToken === 'string'
          ? (body.data.recaptchaToken as string)
          : '';

      // recaptchaToken is not a schema field — never persist it.
      if (body?.data) delete body.data.recaptchaToken;

      const cfg = (await strapi
        .documents('api::smtp-setting.smtp-setting')
        .findFirst()) as Record<string, unknown> | null;

      if (cfg?.recaptchaEnabled === true) {
        const secret = (cfg.recaptchaSecretKey as string) ?? '';
        if (!secret) {
          strapi.log.error(
            '[dealer-submission] reCAPTCHA enabled but no secret key configured; rejecting submission.',
          );
          return ctx.badRequest('reCAPTCHA is not configured correctly.');
        }
        if (!token) {
          return ctx.badRequest('reCAPTCHA token missing.');
        }

        try {
          const res = await fetch(
            'https://www.google.com/recaptcha/api/siteverify',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ secret, response: token }).toString(),
            },
          );
          const result = (await res.json()) as {
            success?: boolean;
            score?: number;
            'error-codes'?: string[];
          };

          if (!result.success || (result.score ?? 0) < MIN_SCORE) {
            strapi.log.warn(
              `[dealer-submission] reCAPTCHA rejected (success=${result.success}, score=${result.score}, errors=${(result['error-codes'] ?? []).join(',')}).`,
            );
            return ctx.badRequest('reCAPTCHA verification failed.');
          }
        } catch (err) {
          strapi.log.error(
            `[dealer-submission] reCAPTCHA verification request failed: ${(err as Error)?.message ?? err}`,
          );
          return ctx.badRequest('Could not verify reCAPTCHA. Please try again.');
        }
      }

      return await super.create(ctx);
    },
  }),
);
