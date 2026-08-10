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
import { encodeAngles } from '../../../utils/encode-angles';
import { DEALER_NOT_SPAM_FILTER } from '../../../utils/dealer-not-spam-filter';
import { PUBLIC_DEALER_FIELDS, toPublicDealer } from '../dto/public-dealer';

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
      // etc.). Recurses into the json fields (services/brands/productTypes
      // arrays, tradingHours object) and leaves numbers/booleans untouched.
      // Side effect worth knowing: this also encodes brackets inside
      // mediaErrors messages, so the odd "&lt;" may show up in the admin email.
      body.data = encodeAngles(data) as Record<string, unknown>;

      return await super.create(ctx);
    },

    /**
     * Public, sanitized dealer directory listing. Bypasses the core
     * find/document-service entirely: `config/api.ts` caps maxLimit at 100 and
     * there are 147 dealers, and the core controller has no way to select an
     * allow-list of fields at the DB layer (PII would still be fetched from
     * SQLite even if stripped after). `strapi.db.query` lets us pass `select`
     * so PII never leaves SQLite in the first place.
     */
    async findPublic(ctx) {
      const rows = await strapi.db
        .query('api::dealer-submission.dealer-submission')
        .findMany({
          select: PUBLIC_DEALER_FIELDS as unknown as string[],
          where: DEALER_NOT_SPAM_FILTER,
          orderBy: [{ state: 'asc' }, { dealershipName: 'asc' }],
        });

      const data = (rows as Record<string, unknown>[]).map(toPublicDealer);

      ctx.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      ctx.body = { data, meta: { total: data.length } };
    },

    /**
     * Public dealer counts per state, for the directory's state filter UI.
     * Route is `/dealer-counts` (not `/dealers/counts`) so it never depends on
     * route-registration order against a future `/dealers/:key` route.
     */
    async stateCounts(ctx) {
      const rows = await strapi.db
        .query('api::dealer-submission.dealer-submission')
        .findMany({
          select: ['state'],
          where: DEALER_NOT_SPAM_FILTER,
        });

      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of rows as { state?: string | null }[]) {
        if (!row.state) continue;
        counts[row.state] = (counts[row.state] ?? 0) + 1;
        total += 1;
      }

      ctx.set('Cache-Control', 'public, max-age=300');
      ctx.body = { data: counts, meta: { total } };
    },
  }),
);
