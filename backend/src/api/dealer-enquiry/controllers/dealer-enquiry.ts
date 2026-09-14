/**
 * dealer-enquiry controller
 *
 * Collects a consumer enquiry to a dealer from /find-dealer. Modelled closely
 * on dealer-submission's `create` (reCAPTCHA + honeypot + timing signals),
 * with one addition: this endpoint also rate-limits by hashed IP, because
 * verify-recaptcha.ts deliberately FAILS OPEN when reCAPTCHA is unconfigured
 * or Google is unreachable. Without the rate limit, that fail-open is the
 * only thing standing between this public endpoint and an unlimited spam
 * flood into every dealer's inbox review queue.
 *
 * NO EMAIL is sent here — this only stores the enquiry. Notifying the dealer
 * is a separate, later concern.
 */

import { factories } from '@strapi/strapi';
import { verifyRecaptcha } from '../../../utils/verify-recaptcha';
import { encodeAngles } from '../../../utils/encode-angles';
import { DEALER_NOT_SPAM_FILTER } from '../../../utils/dealer-not-spam-filter';
import { hashIp } from '../../../utils/hash-ip';
import { fetchCachedDealer } from '../../../utils/dealer-cache-lookup';

const DEALER_UID = 'api::dealer-submission.dealer-submission';
const ENQUIRY_UID = 'api::dealer-enquiry.dealer-enquiry';

// Own reCAPTCHA action so this endpoint's score distribution never mixes with
// the dealer onboarding form's in the Google console.
const ACTION_ENQUIRY = 'dealer_enquiry';

// Anything faster than this was not a human reading a dealer's page and
// typing a message — advisory only, mirrors dealer-submission's timing check.
const MIN_ELAPSED_MS = 2000;

const RATE_LIMIT_PER_IP = 5;
const RATE_LIMIT_WINDOW_IP_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_IP_DEALER = 2;
const RATE_LIMIT_WINDOW_IP_DEALER_MS = 60 * 60 * 1000;

const MAX_LENGTHS = {
  name: 120,
  email: 180,
  phone: 40,
  postcode: 8,
  interest: 160,
  message: 2000,
  // Connect ids are either a 26-character ULID `submission_id` or a `reference`
  // like `caraveacomp|Vrpb3uPIK2QxIgYyeHWA` (33 characters). The cap only stops
  // an unbounded string being stored on the honeypot path, which is the one
  // place this value is recorded without having been resolved against Connect
  // first — do not shrink it to fit either format exactly.
  dealerExternalId: 64,
};

// Single valid address only — no comma/semicolon-separated lists.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Header-injection defence: these fields end up in places (denormalised
// dealerName, future admin views) that must never carry an embedded newline.
const stripCRLF = (value: string): string => value.replace(/[\r\n]+/g, ' ');

const cleanSingleLine = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = stripCRLF(value).trim().slice(0, maxLength);
  return cleaned || undefined;
};

type DealerRow = { id: number; documentId: string; dealershipName: string };

async function findDealerRow(dealerDocumentId: string): Promise<DealerRow | null> {
  if (!dealerDocumentId) return null;
  return strapi.db.query(DEALER_UID).findOne({
    where: { documentId: dealerDocumentId, ...DEALER_NOT_SPAM_FILTER },
    select: ['id', 'documentId', 'dealershipName'],
  }) as Promise<DealerRow | null>;
}

/**
 * A dealer an enquiry can be filed against, from either source.
 *
 * /find-dealer lists dealers out of the local `dealer` cache, so the id in
 * `data.dealer` is normally a Connect `reference` (`caraveacomp|Vrpb3uPIK2Qx…`)
 * matching a cached row rather than a dealer-submission documentId. The
 * dealer-submission lookup still runs FIRST: it is a cheap SQLite read and it
 * keeps an enquiry sent from a page cached before any of these swaps working.
 *
 * Since ETN-013 neither path leaves this server. The cache read replaced a SCAN
 * of Connect's paginated list — up to 20 sequential outbound requests per
 * submission, on a public endpoint whose only protection is a rate limit of 5
 * per IP per 15 minutes.
 *
 * `name` is ALWAYS taken from whichever source resolved the dealer, never from
 * the request body: it is denormalised onto the stored row, so an attacker who
 * could set it could write whatever they liked into an admin's view of who an
 * enquiry was for.
 */
type ResolvedDealer = {
  row: DealerRow | null;
  externalId: string | null;
  name: string;
  /**
   * Connect's own company id for this dealer, denormalised onto the enquiry so a
   * lead can be correlated back to Connect's company record (ETN-016).
   *
   * Resolved here, from the row, for exactly the reason `name` is: it is stored
   * on the enquiry and read by whoever works the lead, so a caller who could set
   * it could point a real consumer's contact details at any company they liked.
   * There is no hidden input for it on the form and there should not be one.
   *
   * `null` is the normal answer. Connect issues this id ON APPROVAL only
   * (ETN-015: 7 of 163 dealers on staging, 0 of 216 on production as at
   * 2026-09-07), and a local dealer-submission row has no Connect id at all. Null
   * means Connect has issued none — never the derived `dz|<stem>|<suburb>` key,
   * which lives on `externalId` and is a different thing.
   */
  caraveaCompanyId: string | null;
};

/**
 * Resolves the dealer or returns the `error` the caller should send back.
 *
 * Approval is NOT checked. Every dealer in the directory can be sent an enquiry,
 * approved by Connect or not — the deliberate change in ETN-010.
 *
 * PUBLICATION STATE IS checked, inside `fetchCachedDealer`. A dealer staff have
 * unpublished in Strapi is REFUSED here, not merely hidden on the page: the
 * enquiry form is gone from their card, but a held link or a plain curl would
 * otherwise still file leads against a dealership the client has delisted. That
 * is ETN-013 D3, and it is what makes a hidden dealer genuinely invisible rather
 * than just absent from a list.
 *
 * Existence still has to be proven, and every failure path DENIES: an enquiry is
 * a lead with a consumer's contact details attached, so an id we cannot resolve
 * must stop the write rather than store a lead against a dealer we could not
 * confirm exists.
 */
async function resolveDealer(
  dealerDocumentId: string,
): Promise<{ dealer?: ResolvedDealer; error?: { code: string; message: string } }> {
  const row = await findDealerRow(dealerDocumentId);
  if (row) {
    // A dealer-submission is our own onboarding record, not a Connect company,
    // so there is no Connect id to carry — null, not a lookup that failed.
    return {
      dealer: { row, externalId: null, name: row.dealershipName, caraveaCompanyId: null },
    };
  }

  const lookup = await fetchCachedDealer(dealerDocumentId);

  if (!lookup.ok) {
    // A hidden dealer and an id that was never real answer identically. Telling
    // an enquirer that a dealership exists but has been delisted is not ours to
    // disclose and is nothing they can act on.
    return { error: { code: 'dealer-not-found', message: 'Unknown dealer.' } };
  }

  return {
    dealer: {
      row: null,
      externalId: dealerDocumentId,
      name: lookup.name,
      caraveaCompanyId: lookup.caraveaCompanyId ?? null,
    },
  };
}

export default factories.createCoreController(ENQUIRY_UID, () => ({
  async create(ctx) {
    const body = ctx.request.body as { data?: Record<string, unknown> };
    const data = body?.data ?? {};

    const dealerDocumentId =
      typeof data.dealer === 'string' ? data.dealer.trim() : '';

    // Per-IP rate limit runs FIRST, ahead of the honeypot branch and the
    // reCAPTCHA check. Both of those can be walked straight past — the
    // honeypot branch below deliberately writes a row and returns 200, and
    // verifyRecaptcha fails open when unconfigured — so anything that writes
    // has to sit behind this. Otherwise `{"comment":"x"}` is an unauthenticated
    // unbounded INSERT loop against a single-writer SQLite file.
    const ipHash = hashIp(ctx);
    const now = Date.now();
    // Compare on `createdAt`, not `submittedAt`, and with a Date rather than an
    // ISO string. SQLite stores these datetime columns as epoch integers, so an
    // ISO string never matches and the count silently returns 0 — i.e. the
    // limit looks present but never fires. `createdAt` is also set by Strapi
    // itself, whereas `submittedAt` arrives in the request payload.
    const fifteenMinAgo = new Date(now - RATE_LIMIT_WINDOW_IP_MS);

    const recentByIp = await strapi.db.query(ENQUIRY_UID).count({
      where: { ipHash, createdAt: { $gte: fifteenMinAgo } },
    });
    if (recentByIp >= RATE_LIMIT_PER_IP) {
      return ctx.tooManyRequests('Too many enquiries. Try again shortly.', {
        code: 'rate-limited',
      });
    }

    // Honeypot: a field hidden off-screen that only a bot fills in. Store the
    // best-effort record flagged, but reveal nothing to the caller — a bot
    // that gets a distinct response for tripping the trap will just stop
    // filling it in.
    const honeypotTripped =
      typeof data.comment === 'string' && data.comment.trim().length > 0;

    if (honeypotTripped) {
      try {
        // dealer-submission lookup only — deliberately no cache read on this
        // path. The caller is a bot; the id is recorded as-is (capped) so the
        // row stays traceable, without spending a query on it.
        const dealerRow = await findDealerRow(dealerDocumentId);
        const payload = encodeAngles({
          dealer: dealerRow?.documentId,
          dealerExternalId: dealerRow
            ? undefined
            : cleanSingleLine(dealerDocumentId, MAX_LENGTHS.dealerExternalId),
          dealerName: dealerRow?.dealershipName,
          name: cleanSingleLine(data.name, MAX_LENGTHS.name) ?? '',
          email: cleanSingleLine(data.email, MAX_LENGTHS.email) ?? '',
          message:
            typeof data.message === 'string'
              ? data.message.trim().slice(0, MAX_LENGTHS.message)
              : '',
          phone: cleanSingleLine(data.phone, MAX_LENGTHS.phone),
          postcode: cleanSingleLine(data.postcode, MAX_LENGTHS.postcode),
          interest: cleanSingleLine(data.interest, MAX_LENGTHS.interest),
          ipHash,
          submittedAt: new Date().toISOString(),
          sourcePage: '/find-dealer',
          spamSuspect: true,
        }) as Record<string, unknown>;

        // `as any`: documents().create() types `data` from the generated
        // content-type schema, but `payload` has passed through the generic
        // `encodeAngles` helper and lost that shape. tsconfig here already
        // runs with strict: false; this is the narrowest possible loosening.
        await strapi.documents(ENQUIRY_UID).create({ data: payload as any });
      } catch (error) {
        strapi.log.warn(
          `[dealer-enquiry] honeypot record failed to store: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      ctx.body = { ok: true };
      return;
    }

    // Timing: client-asserted, so advisory only — a signal, not a gate.
    const tooFast =
      typeof data.elapsedMs === 'number' &&
      data.elapsedMs > 0 &&
      data.elapsedMs < MIN_ELAPSED_MS;

    const token =
      typeof data.recaptchaToken === 'string' ? data.recaptchaToken : '';

    const verification = await verifyRecaptcha(strapi, {
      token,
      action: ACTION_ENQUIRY,
      remoteIp: ctx.request.ip,
    });

    if (!verification.ok) {
      return ctx.badRequest('reCAPTCHA verification failed.', {
        code: verification.code ?? 'recaptcha-failed',
      });
    }

    // Resolves against dealer-submission first, then the `dealer` cache. Proves
    // the dealer exists AND is published (ETN-013 D3), and takes their name from
    // the row rather than the request body. Still does not gate on approval, so
    // an unapproved dealer can be enquired with here exactly as they can from
    // DealerModal.
    const resolved = await resolveDealer(dealerDocumentId);
    if (resolved.error) {
      return ctx.badRequest(resolved.error.message, { code: resolved.error.code });
    }
    const dealer = resolved.dealer;

    // Second, narrower limit: the same visitor repeatedly messaging ONE dealer.
    // Needs the resolved dealer, so it can only run here; the broad per-IP
    // limit above already bounds total writes. The `where` matches on whichever
    // identifier this dealer actually has — a Connect-sourced dealer has no
    // relation to count on, and matching only `dealer` would leave every
    // Connect dealer with no per-dealer limit at all.
    const sixtyMinAgo = new Date(now - RATE_LIMIT_WINDOW_IP_DEALER_MS);

    const recentByIpAndDealer = await strapi.db.query(ENQUIRY_UID).count({
      where: {
        ipHash,
        createdAt: { $gte: sixtyMinAgo },
        ...(dealer.row
          ? { dealer: dealer.row.id }
          : { dealerExternalId: dealer.externalId }),
      },
    });
    if (recentByIpAndDealer >= RATE_LIMIT_PER_IP_DEALER) {
      return ctx.tooManyRequests('Too many enquiries. Try again shortly.', {
        code: 'rate-limited',
      });
    }

    // Validate + sanitize.
    const name = cleanSingleLine(data.name, MAX_LENGTHS.name);
    if (!name) {
      return ctx.badRequest('Name is required.', {
        code: 'invalid-field',
        field: 'name',
      });
    }

    const email = cleanSingleLine(data.email, MAX_LENGTHS.email);
    if (!email || !EMAIL_RE.test(email)) {
      return ctx.badRequest('A valid email address is required.', {
        code: 'invalid-field',
        field: 'email',
      });
    }

    const message =
      typeof data.message === 'string'
        ? data.message.trim().slice(0, MAX_LENGTHS.message)
        : '';
    if (!message) {
      return ctx.badRequest('A message is required.', {
        code: 'invalid-field',
        field: 'message',
      });
    }

    const phone = cleanSingleLine(data.phone, MAX_LENGTHS.phone);
    const postcode = cleanSingleLine(data.postcode, MAX_LENGTHS.postcode);
    const interest = cleanSingleLine(data.interest, MAX_LENGTHS.interest);

    const payload = encodeAngles({
      // Exactly one of these is set: the relation for a local dealer, the
      // Connect submission_id for a pulled one.
      dealer: dealer.row?.documentId,
      dealerExternalId: dealer.externalId ?? undefined,
      dealerName: dealer.name,
      // Additive, NOT a replacement for dealerExternalId: that stays the
      // directory match key this enquiry was filed under, which is what still
      // finds the dealer if their Connect id later changes the ref. This is
      // Connect's own company id, and `undefined` (so the column stays NULL)
      // whenever they have not issued one.
      caraveaCompanyId: dealer.caraveaCompanyId ?? undefined,
      name,
      email,
      message,
      phone,
      postcode,
      interest,
      ipHash,
      submittedAt: new Date().toISOString(),
      sourcePage: '/find-dealer',
      spamSuspect: tooFast,
    }) as Record<string, unknown>;

    // `as any`: see the comment on the honeypot branch above.
    await strapi.documents(ENQUIRY_UID).create({ data: payload as any });

    // Never echo the stored record back to the caller.
    ctx.body = { ok: true };
  },
}));
