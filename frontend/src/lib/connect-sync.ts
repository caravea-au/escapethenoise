// Pure, framework-free logic for the Caravea Connect push receiver
// (app/api/connect/sync/route.ts). Kept free of Next imports on purpose: the
// repo has no test runner, and scripts/verify-connect-sync.mjs exercises this
// file directly with plain `node`, so what the script proves is the exact code
// the route runs.
//
// Contract (docs/nobettertime-staging-connect.md, "OUTBOUND"): Connect POSTs
// dealer events with
//   X-Caravea-Timestamp: <UTC ISO-8601>
//   X-Caravea-Signature: sha256=<lowercase hex>
// where the digest is HMAC-SHA256 over `<timestamp> + "\n" + <exact raw body>`
// keyed with the shared secret. The receiver verifies before parsing anything.

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature header shape: the `sha256=` prefix is part of the value, not the
 * digest, and the hex must be lowercase and exactly 64 digits. Anything else
 * (uppercase hex, missing prefix, wrong length, whitespace) fails here before
 * any decoding is attempted.
 */
const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/;

/**
 * Connect sends Laravel's `toIso8601String()` output, e.g.
 * `2026-08-14T12:00:00+00:00`. Accept an optional fractional-seconds part and
 * either `Z` or a numeric offset; a bare date ("2026-08-14") is NOT a valid
 * webhook timestamp. The RAW header string is what gets signed, so this
 * validates the shape without ever normalising it before hashing.
 */
const ISO_8601_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * How far the Connect server's clock may sit from ours and a delivery still be
 * accepted, in seconds. Default 900s: Connect's queue retries a failed attempt
 * at 60/300/900s backoff, so the sender's own schedule can legally deliver a
 * correctly-signed event 15 minutes after it was signed. Whether Connect
 * re-signs per retry attempt or signs once at enqueue time is UNRESOLVED
 * (ticket ETN-018) — 900s covers the whole backoff ladder either way, and the
 * window is tunable via CONNECT_SYNC_CLOCK_TOLERANCE_SECONDS on the route side
 * so a "re-signs per retry" answer that shortens it is an env change, not a
 * code change.
 */
export const DEFAULT_CLOCK_TOLERANCE_SECONDS = 900;

export type SignatureFailureReason =
  | "missing-secret"
  | "malformed-signature"
  | "malformed-timestamp"
  | "stale-timestamp"
  | "bad-signature";

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: SignatureFailureReason };

/**
 * Reasons are static labels, never derived from request content, so the route
 * may log them: they tell an operator which layer refused without echoing any
 * request data back to the caller.
 */
export function verifyConnectSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string | undefined | null,
  options: { nowMs?: number; toleranceSeconds?: number } = {},
): SignatureCheck {
  // Fail closed on an unset or blank secret: this is "the receiver is not
  // configured", and the correct answer to an unverified caller is always 401.
  if (!secret) {
    return { ok: false, reason: "missing-secret" };
  }

  const signatureMatch =
    signatureHeader === null ? null : SIGNATURE_PATTERN.exec(signatureHeader);
  if (!signatureMatch) {
    return { ok: false, reason: "malformed-signature" };
  }

  // Order matters: the timestamp is part of the signed input, so a malformed
  // one can never be allowed to reach a digest comparison it would fail anyway
  // — but checking it before computing the HMAC keeps the stale-timestamp and
  // bad-signature outcomes distinguishable in logs.
  if (timestampHeader === null || !ISO_8601_DATETIME.test(timestampHeader)) {
    return { ok: false, reason: "malformed-timestamp" };
  }
  const timestampMs = Date.parse(timestampHeader);
  if (Number.isNaN(timestampMs)) {
    // The regex passed but the calendar rejected it (e.g. 2026-02-30).
    return { ok: false, reason: "malformed-timestamp" };
  }
  const toleranceMs =
    (options.toleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS) * 1000;
  const nowMs = options.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampMs) > toleranceMs) {
    return { ok: false, reason: "stale-timestamp" };
  }

  // HMAC over the exact string the sender signed: raw timestamp header, a
  // newline, then the raw body as received. No trimming, no re-encoding.
  const expected = createHmac("sha256", secret)
    .update(`${timestampHeader}\n${rawBody}`)
    .digest();

  // SIGNATURE_PATTERN guarantees exactly 64 hex digits, so the decoded buffer
  // is exactly 32 bytes — the same length as the digest. The explicit length
  // pre-check keeps timingSafeEqual's length-mismatch throw unreachable even
  // if the pattern above is ever loosened.
  const provided = Buffer.from(signatureMatch[1], "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  return { ok: true };
}

/** Static strings only — safe to log. `event` and the id come from the payload. */
export type EventSummary = {
  event: string;
  caraveaCompanyId: string | null;
};

/**
 * Extracts only the two fields the receiver logs (event name, stable company
 * key) from a verified body. Returns null when the JSON does not parse — a
 * verified-but-unparseable delivery is accepted by the route and logged as
 * "(unparsed)", never rejected. Nothing else in the body is read or retained:
 * it can carry dealer contact details (PII), so it must never reach a log line.
 */
export function parseEventSummary(rawBody: string): EventSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") {
    return null;
  }
  const envelope = parsed as {
    event?: unknown;
    company?: { caravea_company_id?: unknown } | null;
  };

  // Both values go into log lines, so both are sanitised for log injection
  // (control/format characters) and capped in length. An unexpected shape
  // logs as its placeholder rather than whatever the body contained.
  return {
    event: cleanLogValue(envelope.event, 64) ?? "(unrecognised)",
    caraveaCompanyId: cleanLogValue(envelope.company?.caravea_company_id, 100),
  };
}

const CONTROL_CHARS = /\p{C}/gu;

function cleanLogValue(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, " ").trim().slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}