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

      // Sanitize every submitted string so no stored value can later be parsed
      // as HTML/script by a future consumer (a directory listing, CSV export,
      // etc.). We HTML-entity-encode angle brackets rather than strip them: this
      // is LOSSLESS, so legitimate copy like "vans < 3.5 tonne" survives while
      // any "<script>" becomes inert "&lt;script&gt;". Recurses into the json
      // fields (services/brands/productTypes arrays, tradingHours object) and
      // leaves numbers/booleans untouched.
      // NOTE: no SQL-keyword filtering — Strapi parameterizes all queries
      // (SQLite here), and stripping keywords would corrupt legitimate values
      // like a dealership named "Select Caravans".
      const encodeAngles = (v: unknown): unknown =>
        typeof v === 'string'
          ? v.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          : Array.isArray(v)
            ? v.map(encodeAngles)
            : v && typeof v === 'object'
              ? Object.fromEntries(
                  Object.entries(v).map(([k, x]) => [k, encodeAngles(x)]),
                )
              : v;
      if (body?.data) {
        body.data = encodeAngles(body.data) as Record<string, unknown>;
      }

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
