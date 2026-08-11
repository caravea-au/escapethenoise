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

const GEOCODE_UID = 'api::dealer-geocode.dealer-geocode';

type GeocodeRow = {
  dealerDocumentId: string;
  latitude: number;
  longitude: number;
  precision: 'street' | 'approx';
};

// reCAPTCHA actions minted by the frontend. The pre-check uses its own action so
// it doesn't pollute the score distribution for real submissions in the console.
const ACTION_SUBMIT = 'dealer_submit';
const ACTION_PRECHECK = 'dealer_precheck';

// Anything faster than this was not typed by a human filling in 47 fields.
const MIN_ELAPSED_MS = 3000;

// Client-only keys that must never be persisted (none is a schema attribute).
// `pin` carries the dealer's map coordinates, which live in the separate
// dealer-geocode collection — see the `capturedPin` handling in `create`.
const TRANSIENT_KEYS = [
  'recaptchaToken',
  'verifyOnly',
  'comment',
  'elapsedMs',
  'pin',
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

      const result = await super.create(ctx);

      // Store the coordinates AFTER the submission is safely saved, because the
      // documentId to key them against does not exist until then.
      //
      // Best-effort by design, exactly like the notification emails in
      // lifecycles.ts: a dealer losing their entire onboarding submission
      // because a coordinate write failed would be far worse than a missing
      // pin, which the team can place later. So this only ever logs.
      //
      // Not in an afterCreate lifecycle: the pin was stripped from `data` above,
      // so the lifecycle's `event.result` never sees it.
      if (capturedPin) {
        try {
          // Read the documentId off the RETURN VALUE, not ctx.body. Strapi's
          // core `create` returns `transformResponse(entity)` and leaves
          // ctx.body untouched — the route layer assigns it afterwards — so
          // ctx.body is still undefined at this point.
          const documentId = (
            result as { data?: { documentId?: string } } | undefined
          )?.data?.documentId;
          if (documentId) {
            // `as any`: documents().create() types `data` from the generated
            // content-type schema; tsconfig here runs with strict: false and
            // this is the narrowest loosening (same pattern as dealer-enquiry).
            await strapi.documents(GEOCODE_UID).create({
              data: { dealerDocumentId: documentId, ...capturedPin } as any,
            });
          } else {
            strapi.log.warn(
              '[dealer-submission] created row exposed no documentId — map pin not stored.',
            );
          }
        } catch (error) {
          strapi.log.warn(
            `[dealer-submission] map pin not stored: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return result;
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

      // Coordinates live in a separate collection (see dealer-geocode), so they
      // cannot ride PUBLIC_DEALER_FIELDS — that array is both the DB `select`
      // and the output allow-list for dealer-submission's OWN columns, and must
      // stay that way. One extra query and a Map keeps this O(1) per dealer
      // rather than N+1, and `toPublicDealer` stays the untouched security gate:
      // the merge happens strictly AFTER it, on the object it returns.
      const geocodes = (await strapi.db.query(GEOCODE_UID).findMany({
        select: ['dealerDocumentId', 'latitude', 'longitude', 'precision'],
      })) as GeocodeRow[];
      const byDealer = new Map(geocodes.map((g) => [g.dealerDocumentId, g]));

      const data = (rows as Record<string, unknown>[]).map((row) => {
        const dealer = toPublicDealer(row);
        const geo = byDealer.get(String(dealer.documentId));
        return {
          ...dealer,
          // Explicit nulls rather than omitted keys, so the frontend always
          // sees the same shape and can fall back to the postcode centroid.
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          precision: geo?.precision ?? null,
        };
      });

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
