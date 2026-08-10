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

import crypto from 'crypto';
import { factories } from '@strapi/strapi';
import { verifyRecaptcha } from '../../../utils/verify-recaptcha';
import { encodeAngles } from '../../../utils/encode-angles';
import { DEALER_NOT_SPAM_FILTER } from '../../../utils/dealer-not-spam-filter';

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

function hashIp(ctx: { request: { ip?: string } }): string {
  const appKeys = strapi.config.get('server.app.keys') as string[] | undefined;
  const appKey = Array.isArray(appKeys) && appKeys[0] ? appKeys[0] : '';
  return crypto
    .createHash('sha256')
    .update(`${ctx.request.ip ?? ''}${appKey}`)
    .digest('hex');
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
        const dealerRow = await findDealerRow(dealerDocumentId);
        const payload = encodeAngles({
          dealer: dealerRow?.documentId,
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

    const dealerRow = await findDealerRow(dealerDocumentId);
    if (!dealerRow) {
      return ctx.badRequest('Unknown dealer.', { code: 'dealer-not-found' });
    }

    // Second, narrower limit: the same visitor repeatedly messaging ONE dealer.
    // Needs the resolved dealer, so it can only run here; the broad per-IP
    // limit above already bounds total writes.
    const sixtyMinAgo = new Date(now - RATE_LIMIT_WINDOW_IP_DEALER_MS);

    const recentByIpAndDealer = await strapi.db.query(ENQUIRY_UID).count({
      where: {
        ipHash,
        dealer: dealerRow.id,
        createdAt: { $gte: sixtyMinAgo },
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
      dealer: dealerRow.documentId,
      dealerName: dealerRow.dealershipName,
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
