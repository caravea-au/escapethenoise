/**
 * Shared reCAPTCHA v3 verification util. Reads the "SMTP Settings" single type via
 * the Document Service for the enabled flag + secret key, then calls Google's
 * siteverify endpoint using the global `fetch` (Node 20+, no extra dependency).
 * Never throws — a disabled/unconfigured recaptcha, or a network failure, only
 * logs and resolves so callers can decide how to respond (fail-open vs fail-closed).
 *
 * Ported from caravea-nextjs-baseplate/backend/src/utils/verify-recaptcha.ts, with
 * the single-type UID corrected to this repo's `smtp-setting` (the baseplate uses
 * a plural `smtp-settings` api folder) and a stable `code` added to every failure
 * so the frontend can map outcomes to specific copy without matching on prose.
 */

import type { Core } from '@strapi/strapi';

export type VerifyRecaptchaOptions = {
  token?: string | null;
  action?: string;
  remoteIp?: string;
};

/**
 * Stable, machine-readable failure codes. These travel to the browser inside
 * `error.details.code`, so treat them as an API contract: the frontend switches
 * on them to pick the message the dealer sees. Add codes, don't rename them.
 *
 * `browser-blocked` is the one that matters most in practice. Google returns
 * `error-codes: ["browser-error"]` when grecaptcha.execute() resolved but the
 * script could not actually complete its assessment in that browser — a blocked
 * google.com, an extension, or a locked-down corporate network. It is NOT a bot
 * signal, and retrying does not help, so it needs its own message.
 */
export type RecaptchaFailureCode =
  | 'recaptcha-missing-token'
  | 'recaptcha-browser-blocked'
  | 'recaptcha-failed'
  | 'recaptcha-action-mismatch'
  | 'recaptcha-low-score'
  | 'recaptcha-unavailable';

/**
 * Flat rather than a discriminated union on `ok`: this backend compiles with
 * `strict: false` (see backend/tsconfig.json), and without strictNullChecks
 * TypeScript will not narrow a boolean-literal discriminant, so
 * `if (!result.ok) result.code` fails to compile. `code` is always set when
 * `ok` is false.
 */
export type VerifyRecaptchaResult = {
  ok: boolean;
  skipped?: boolean;
  code?: RecaptchaFailureCode;
  score?: number;
  errors?: string[];
};

const MIN_SCORE = 0.5;
const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

type SiteverifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
};

export async function verifyRecaptcha(
  strapi: Core.Strapi,
  { token, action, remoteIp }: VerifyRecaptchaOptions
): Promise<VerifyRecaptchaResult> {
  const settings = (await strapi
    .documents('api::smtp-setting.smtp-setting')
    .findFirst()) as Record<string, unknown> | null;

  if (settings?.recaptchaEnabled !== true) {
    return { ok: true, skipped: true };
  }


  const secret = settings.recaptchaSecretKey as string | undefined;
  if (!secret) {
    // Fail OPEN, deliberately: a missing secret is our misconfiguration, and
    // rejecting real dealerships over it is strictly worse than accepting them
    // unverified. The warning is the alert.
    strapi.log.warn(
      '[recaptcha] enabled but no secret key configured — skipping verification'
    );
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, code: 'recaptcha-missing-token' };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Bound the call so a hung/slow Google response can't hold the submit open.
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json()) as SiteverifyResponse;

    if (data.success !== true) {
      const errors = data['error-codes'] ?? [];
      const browserBlocked = errors.includes('browser-error');
      strapi.log.warn(
        `[recaptcha] rejected (score=${data.score ?? 'n/a'}, hostname=${
          data.hostname ?? 'n/a'
        }, errors=${errors.join(',') || 'none'})`
      );
      return {
        ok: false,
        code: browserBlocked ? 'recaptcha-browser-blocked' : 'recaptcha-failed',
        errors,
      };
    }

    // Anti-replay: reject tokens minted for a different action.
    if (action && data.action && data.action !== action) {
      strapi.log.warn(
        `[recaptcha] action mismatch (expected=${action}, got=${data.action})`
      );
      return { ok: false, code: 'recaptcha-action-mismatch' };
    }

    // Guard the type rather than `?? 0`: v2 keys return success with NO score,
    // and coercing that to 0 would reject every single submission.
    if (typeof data.score === 'number' && data.score < MIN_SCORE) {
      strapi.log.warn(`[recaptcha] low score (${data.score} < ${MIN_SCORE})`);
      return { ok: false, code: 'recaptcha-low-score', score: data.score };
    }

    return { ok: true, score: data.score };
  } catch (error) {
    strapi.log.error(
      `[recaptcha] verify request failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { ok: false, code: 'recaptcha-unavailable' };
  }
}
