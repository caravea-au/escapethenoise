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
import { validateDealerPin } from '../../../utils/dealer-pin';
import { PUBLIC_DEALER_FIELDS, toPublicDealer } from '../dto/public-dealer';

// reCAPTCHA actions minted by the frontend. The pre-check uses its own action so
// it doesn't pollute the score distribution for real submissions in the console.
const ACTION_SUBMIT = 'dealer_submit';
const ACTION_PRECHECK = 'dealer_precheck';

// Anything faster than this was not typed by a human filling in 47 fields.
const MIN_ELAPSED_MS = 3000;

// Client-only keys that must never be persisted (none is a schema attribute).
// `pin` carries the dealer's map coordinates as a nested object; `create`
// captures and validates it, then writes the flat columns itself.
//
// This strip is LOAD-BEARING, not an optimisation. Strapi's core create runs
// validateInput BEFORE sanitizeInput, and validateInput applies
// throwUnrecognizedFields unconditionally — it is not gated by `strictParams`,
// which this project never sets. So a root key with no matching attribute is a
// 400, not a silent drop.
const TRANSIENT_KEYS = [
  'recaptchaToken',
  'verifyOnly',
  'comment',
  'elapsedMs',
  'pin',
];

// The six coordinate attributes. They ARE schema attributes, so unlike
// TRANSIENT_KEYS Strapi would happily persist whatever arrives in them — and
// `dealer-submission.create` is a PUBLIC, unauthenticated route (see
// PUBLIC_ACTIONS in src/index.ts). Left unstripped, a caller with curl could set
// coordinates directly, skipping every control in validateDealerPin (AU bounds,
// the far-from-postcode precision downgrade, cleanAddress and its
// CSV-formula-injection guard) and assert `geocodeSource: 'admin'`. Those forged
// coordinates would then be published on /find-dealer, because latitude,
// longitude and precision are in PUBLIC_DEALER_FIELDS.
//
// So: strip all six from client input, then write only what validateDealerPin
// returns. These are server-owned.
const SERVER_OWNED_KEYS = [
  'latitude',
  'longitude',
  'precision',
  'geocodeSource',
  'matchedAddress',
  'geocodedAddress',
];

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

      // Capture the map pin BEFORE the strip loop below removes it. Validation
      // is authoritative here: this is public unauthenticated input, and the
      // browser's own bounds/enum checks are a courtesy, not a control.
      const capturedPin = validateDealerPin(data.pin, data.postcode);

      // Strip transient AND server-owned keys before anything touches the DB.
      // Both matter, for different reasons: a transient key would be REJECTED by
      // validateInput (a 400 for the dealer), while a server-owned key would be
      // ACCEPTED and persisted unvalidated. See the two comment blocks above.
      for (const key of [...TRANSIENT_KEYS, ...SERVER_OWNED_KEYS]) {
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
      //
      // The validated pin is merged in HERE, before the call, so the coordinates
      // ride the normal create path and land in `event.result` for the
      // notification email. Passing it through encodeAngles is safe both ways:
      // the numbers are returned untouched, and cleanAddress has already turned
      // any angle bracket into `&lt;`, which encodeAngles leaves alone (it
      // rewrites `<` and `>`, never `&`, so it cannot double-encode).
      body.data = encodeAngles({
        ...data,
        ...(capturedPin ?? {}),
      }) as Record<string, unknown>;

      // The coordinates are plain columns on this row now, so they are written
      // by the create above — no second write keyed on the new documentId, and
      // nothing to reconcile if that write were to fail.
      //
      // The trade-off, stated plainly: the old sidecar write was wrapped in a
      // try/catch and only logged, so a coordinate problem could never cost a
      // dealer their submission. It can now. Everything that could fail has been
      // removed rather than caught — the six attributes are optional,
      // defaultless, unconstrained, and `text` rather than a length-limited
      // varchar, and validateDealerPin degrades bad input to null instead of
      // throwing. Keep it that way; do not add `required`, a `maxLength`, or a
      // unique index to any of them.
      return super.create(ctx);
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

      // Coordinates are columns on this row, so they ride PUBLIC_DEALER_FIELDS
      // like everything else and need no second query. toPublicDealer's
      // `row[field] ?? null` gives the explicit nulls the frontend depends on:
      // it always sees the same shape and falls back to the postcode centroid.
      //
      // geocodeSource, matchedAddress and geocodedAddress are deliberately NOT
      // in that array. It is both the DB `select` and the output allow-list, so
      // they never leave SQLite — matchedAddress in particular is raw upstream
      // Nominatim text. They are also `private` in the schema, which covers the
      // paths that go through Strapi's own sanitizeOutput rather than this one.
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
