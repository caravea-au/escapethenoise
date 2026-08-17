/**
 * connect controller
 *
 * `POST /connect/push` — a manual re-push lever for Caravea Connect
 * (`{CONNECT_API_URL}/api/public/dealer-registrations`), used by
 * scripts/connect-push-dealers.mjs to backfill the dealers who already exist
 * in Strapi and by anyone re-pushing a row that missed the lifecycle hook.
 *
 * This API has NO content type, deliberately — see the header comment on
 * routes/connect.ts for why that matters for the Public role's checkbox
 * list. It owns no data of its own: every row it receives is mapped through
 * the SAME `toConnectRegistration` / `shouldPushToConnect` pair the
 * dealer-submission lifecycle uses, so the mapping rules are defined once.
 *
 * Two guards beyond auth:
 *   - Every row is rebuilt from an EXPLICIT allow-list of expected keys
 *     (`pickRow`) before it ever reaches the mapper. The caller's object is
 *     never spread in directly — an unexpected key (a Strapi internal, a
 *     stray script typo) can never ride along into a third party's payload.
 *   - The batch is capped at 50 rows. All 162 real rows serialise to about
 *     0.52 MB and the largest single row is 11.5 KB, so 50 rows comfortably
 *     clears `strapi::body`'s default 1 MB `jsonLimit` with room to spare;
 *     a bigger batch is rejected outright rather than silently truncated.
 *
 * The response is a per-row outcome array only — `documentId`, `status`,
 * and an `outcome`/`reason` code — so the calling script can report
 * accurately. Connect's own response body is NEVER echoed back: its 422s are
 * Laravel validation errors that repeat submitted field names and values,
 * which would leak dealer PII into whatever logs or files the caller writes.
 */

import { isConnectEnabled, postDealerRegistration } from '../../../utils/connect-client';
import { shouldPushToConnect, toConnectRegistration } from '../../../utils/connect-registration';

const MAX_BATCH_SIZE = 50;

// Explicit allow-list of the row keys `toConnectRegistration` /
// `shouldPushToConnect` actually read. Anything not in this list is dropped
// before the row is built — see the module header for why this matters on a
// write-through proxy into a third party's dataset. `documentId` is handled
// separately below: it identifies the row for the response, but is never
// part of the object handed to the mapper (the mapper never reads it, and
// Connect's contract has no such field).
const ALLOWED_ROW_KEYS = [
  'dealershipName',
  'legalName',
  'abn',
  'established',
  'dms',
  'dmsOther',
  'street',
  'suburb',
  'state',
  'postcode',
  'latitude',
  'longitude',
  'precision',
  'geocodedAddress',
  'motorDealerLicenceName',
  'motorDealerLicenceNumber',
  'phone',
  'leadsEmail',
  'smsNumber',
  'contactName',
  'contactRole',
  'enquiriesEmail',
  'services',
  'servicesOther',
  'brands',
  'brandsOther',
  'productTypes',
  'productsOther',
  'stockCondition',
  'website',
  'description',
  'facebook',
  'instagram',
  'youtube',
  'googleProfile',
  'tradingHours',
  'logo',
  'photos',
  'multipleLocations',
  'financeAvailable',
  'deliveryAvailable',
  'rvmapBadged',
  'rvmasterBadged',
  'submitterName',
  'submitterEmail',
  'submitterPhone',
  'stateAssociation',
  'authorised',
  'privacyConsent',
  'marketingConsent',
  'submittedAt',
  'spamSuspect',
] as const;

/** Rebuilds a row from the allow-list above only — never a spread of the input. */
function pickRow(input: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of ALLOWED_ROW_KEYS) {
    if (key in input) row[key] = input[key];
  }
  return row;
}

type PushOutcome = {
  documentId: string | null;
  status: 'pushed' | 'would-push' | 'skipped' | 'failed' | 'error';
  reason?: string;
};

export default {
  async push(ctx) {
    if (!isConnectEnabled()) {
      return ctx.badRequest(
        'Caravea Connect is not configured (CONNECT_API_URL / CONNECT_API_KEY unset).',
        { code: 'connect-disabled' },
      );
    }

    const body = ctx.request.body as { data?: unknown; dryRun?: unknown } | undefined;
    const rows = body?.data;
    // Runs every row through the same mapping/gating as a real push, but never
    // calls postDealerRegistration — so the backfill script's `--dry` mode can
    // exercise the ONE mapper/gate implementation this route wraps (rather
    // than a second copy in the script) without creating a real, non-idempotent
    // submission in Connect.
    const dryRun = body?.dryRun === true;

    if (!Array.isArray(rows) || rows.length === 0) {
      return ctx.badRequest('Body must be { data: [...] }, a non-empty array of dealer rows.', {
        code: 'invalid-batch',
      });
    }

    if (rows.length > MAX_BATCH_SIZE) {
      return ctx.badRequest(
        `Batch too large: ${rows.length} rows, max ${MAX_BATCH_SIZE} per request.`,
        { code: 'batch-too-large' },
      );
    }

    strapi.log.info(`connect/push: dryRun=${dryRun} rows=${rows.length}`);

    const results: PushOutcome[] = [];

    for (const raw of rows) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        results.push({ documentId: null, status: 'error', reason: 'invalid-row' });
        continue;
      }

      const input = raw as Record<string, unknown>;
      const documentId = typeof input.documentId === 'string' ? input.documentId : '';

      if (!documentId) {
        results.push({ documentId: null, status: 'error', reason: 'missing-document-id' });
        continue;
      }

      const row = pickRow(input);

      try {
        const gate = shouldPushToConnect(row);
        if (!gate.ok) {
          results.push({ documentId, status: 'skipped', reason: gate.reason });
          continue;
        }

        // Builds the payload even in dry-run, so a malformed row surfaces as an
        // error here rather than only being discovered on the first real push.
        const payload = toConnectRegistration(row);

        if (dryRun) {
          results.push({ documentId, status: 'would-push' });
          continue;
        }

        const result = await postDealerRegistration(strapi, documentId, payload);

        if (result.ok) {
          results.push({ documentId, status: 'pushed' });
        } else {
          // Explicit cast, not a narrowing `else`: this backend compiles with
          // `strict: false` (backend/tsconfig.json), and without
          // strictNullChecks TypeScript does not narrow a discriminated union
          // on a boolean-literal `ok` check — same root cause noted on
          // `ConnectPushGateResult` in connect-registration.ts.
          const failure = result as { ok: false; status: number; code: string };
          results.push({ documentId, status: 'failed', reason: failure.code });
        }
      } catch (err) {
        // One throwing row (a malformed gate/mapper input we didn't
        // anticipate) must not turn the whole batch into a 500 — contain it
        // per-row and keep processing the rest.
        strapi.log.error(`connect/push: row ${documentId} threw`, err);
        results.push({ documentId, status: 'error', reason: 'mapper-error' });
      }
    }

    ctx.body = { data: results };
  },
};
