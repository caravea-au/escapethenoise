/**
 * dealer-submission controller
 *
 * Overrides `create` to verify a Google reCAPTCHA v3 token before saving, and to
 * record (never enforce) the honeypot / submit-timing spam signals.
 *
 * Every rejection carries a stable `code` in `details` so the form can show a
 * specific, actionable message instead of one generic sentence. Verification
 * itself lives in src/utils/verify-recaptcha.ts.
 *
 * `verifyOnly: true` runs the reCAPTCHA check and returns without creating
 * anything. The form calls it BEFORE uploading photos so a dealer whose network
 * blocks Google finds out in about a second, rather than after a multi-minute
 * upload that then gets thrown away.
 */

import { factories } from '@strapi/strapi';
import { verifyRecaptcha } from '../../../utils/verify-recaptcha';

// reCAPTCHA actions minted by the frontend. The pre-check uses its own action so
// it doesn't pollute the score distribution for real submissions in the console.
const ACTION_SUBMIT = 'dealer_submit';
const ACTION_PRECHECK = 'dealer_precheck';

// Anything faster than this was not typed by a human filling in 47 fields.
const MIN_ELAPSED_MS = 3000;

// Client-only keys that must never be persisted (none is a schema attribute).
const TRANSIENT_KEYS = ['recaptchaToken', 'verifyOnly', 'comment', 'elapsedMs'];

export default factories.createCoreController(
  'api::dealer-submission.dealer-submission',
  () => ({
    async create(ctx) {
      const body = ctx.request.body as { data?: Record<string, unknown> };
      const data = body?.data ?? {};

      const token =
        typeof data.recaptchaToken === 'string' ? data.recaptchaToken : '';
      const verifyOnly = data.verifyOnly === true;

      // Honeypot: a field hidden off-screen that only a bot fills in.
      const honeypotTripped =
        typeof data.comment === 'string' && data.comment.trim().length > 0;
      // Timing: client-asserted, so advisory only — a signal, not a gate.
      const tooFast =
        typeof data.elapsedMs === 'number' &&
        data.elapsedMs > 0 &&
        data.elapsedMs < MIN_ELAPSED_MS;

      const verification = await verifyRecaptcha(strapi, {
        token,
        action: verifyOnly ? ACTION_PRECHECK : ACTION_SUBMIT,
        remoteIp: ctx.request.ip,
      });

      if (!verification.ok) {
        return ctx.badRequest('reCAPTCHA verification failed.', {
          code: verification.code ?? 'recaptcha-failed',
        });
      }

      // Pre-check only wants to know whether the token would be accepted.
      if (verifyOnly) {
        ctx.body = { ok: true };
        return;
      }

      // Strip transient keys before anything touches the DB. Strapi's
      // sanitizeInput would drop unknown attributes anyway; this keeps the
      // sanitiser below from walking values we never intend to store.
      for (const key of TRANSIENT_KEYS) {
        delete data[key];
      }

      const spamSignals = [
        honeypotTripped ? 'honeypot' : null,
        tooFast ? 'fast-submit' : null,
      ].filter(Boolean) as string[];

      if (spamSignals.length > 0) {
        // Flag, don't reject. In 102 real submissions these heuristics have never
        // been exercised, so a false positive would cost a genuine dealership and
        // catch nothing. Review the flag before ever turning this into a block.
        strapi.log.warn(
          `[dealer-submission] spam signals (${spamSignals.join(
            ','
          )}) on "${String(data.dealershipName ?? 'unknown')}" — saving flagged.`
        );
        data.spamSuspect = true;
      }

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
      // Side effect worth knowing: this also encodes brackets inside
      // mediaErrors messages, so the odd "&lt;" may show up in the admin email.
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
      body.data = encodeAngles(data) as Record<string, unknown>;

      return await super.create(ctx);
    },
  }),
);
