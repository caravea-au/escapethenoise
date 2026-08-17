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
import { fetchConnectDealer } from '../../../utils/connect-lookup';

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
  // Connect's submission ids are 26-character ULIDs; the cap only stops an
  // unbounded string being stored on the honeypot path, which is the one place
  // this value is recorded without having been resolved against Connect first.
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
 * /find-dealer now lists dealers pulled from Caravea Connect, so the id in
 * `data.dealer` is normally a Connect `submission_id` that matches no local
 * row. The local lookup still runs first — it is a cheap SQLite read, it keeps
 * any enquiry sent from a cached page still holding Strapi documentIds working,
 * and it avoids a network round trip on those.
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
};

/**
 * Resolves the dealer or returns the `error` the caller should send back.
 *
 * Every failure path DENIES. An enquiry is a lead with a consumer's contact
 * details attached, so an unapproved dealer, an unknown id, or a Connect we
 * cannot reach must all stop the write rather than store a lead against a
 * dealer whose standing we could not confirm.
 */
async function resolveDealer(
  dealerDocumentId: string,
): Promise<{ dealer?: ResolvedDealer; error?: { code: string; message: string } }> {
  const row = await findDealerRow(dealerDocumentId);
  if (row) {
    return { dealer: { row, externalId: null, name: row.dealershipName } };
  }

  const lookup = await fetchConnectDealer(strapi, dealerDocumentId);

  if (!lookup.ok) {
    // `connect-disabled` (no CONNECT_API_URL/KEY on this box) is reported as
    // unavailable rather than not-found: the dealer may well exist, this
    // environment simply cannot check. Telling the visitor their dealer
    // "couldn't be found" would be a lie about our own misconfiguration.
    if (lookup.code === 'dealer-not-found') {
      return { error: { code: 'dealer-not-found', message: 'Unknown dealer.' } };
    }
    return {
      error: {
        code: 'connect-unavailable',
        message: 'Dealer details are temporarily unavailable.',
      },
    };
  }

  if (!lookup.approved) {
    return {
      error: {
        code: 'dealer-not-approved',
        message: 'This dealer is not accepting enquiries yet.',
      },
    };
  }

  return { dealer: { row: null, externalId: dealerDocumentId, name: lookup.name } };
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
        // Local lookup only — deliberately no Connect round trip on this path.
        // The caller is a bot; the id is recorded as-is (capped) so the row is
        // still traceable, without spending a network call on it.
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

    // Resolves against the local table first, then Caravea Connect — and also
    // enforces the approval gate. DealerModal hides the enquiry form for an
    // unapproved dealer, but hiding a form stops nobody from POSTing to this
    // endpoint directly, so approval is checked again here where it counts.
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
