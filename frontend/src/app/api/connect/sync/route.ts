// Outbound push receiver for Caravea Connect (ETN-018). Connect POSTs
// HMAC-signed dealer events (dealer.approved, dealer.suspended,
// company_information.updated) and this is the endpoint its ops team points
// NOBETTERTIME_SYNC_URL at. Until CONNECT_SYNC_SECRET is set the route 401s
// everything and the push channel stays dormant, exactly like /api/revalidate.
//
// WHY A NEXT ROUTE HANDLER, not Strapi: two hard constraints from the vault
// runbook. Only Next may call revalidateTag, and only `await request.text()`
// preserves the exact raw bytes the HMAC is computed over — Strapi's
// strapi::body middleware consumes the request stream before a controller ever
// sees it, so an HMAC over the body is not computable there.
//
// WHAT HAPPENS ON A VERIFIED DELIVERY (and nothing else — the payload is never
// upserted into Strapi directly):
//   1. Trigger the existing full dealer sweep by POSTing Strapi's
//      /api/integrations/dealers/sync with STRAPI_API_TOKEN. That route
//      requires full-access token auth; the frontend's token is documented
//      read-only in docs/deploy/env.frontend.template, so in practice this
//      trigger 401s and degrades. That is by design: the sweep already runs on
//      its own schedule and the trigger is only the shortcut from minutes to
//      seconds. A trigger failure is logged, never surfaced to Connect.
//   2. Invalidate the frontend data cache for the dealer read
//      (DEALERS_TAG, { expire: 0 }) so /find-dealer shows the sweep's result on
//      the next load instead of after the 60s ISR window.
// Any 2xx is accepted by Connect (docs/nobettertime-staging-connect.md,
// "Expected response"), so this returns 200 { received: true } for every
// verified delivery regardless of what the sweep and revalidation did: a 5xx
// would buy an immediate sender retry that cannot fix a scoped token.
//
// SECURITY SHAPE, fail closed throughout: size cap and per-IP rate limit run
// before the body is read; the signature header is shape-checked before any
// decoding; HMAC and timestamp window are checked before the body is parsed;
// every failure below verification is a bare 401 with no detail. The secret and
// the body are never logged — the body can carry dealer PII. Log lines carry
// event name, caravea_company_id and outcome only.

import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_CLOCK_TOLERANCE_SECONDS,
  parseEventSummary,
  verifyConnectSignature,
} from "@/lib/connect-sync";
import { DEALERS_TAG, STRAPI_URL } from "@/lib/strapi";

// Read at request time, not module scope, so an unset secret makes the route
// refuse everything (fail closed) rather than break the build.
function connectSecret(): string | undefined {
  return process.env.CONNECT_SYNC_SECRET;
}

/**
 * Clock window in seconds, env-tunable for the unresolved "does Connect re-sign
 * per queue retry?" question. See connect-sync.ts for why the default is 900.
 * A malformed or non-positive value falls back to the default rather than
 * silently widening or zeroing the window.
 */
function clockToleranceSeconds(): number {
  const raw = Number(process.env.CONNECT_SYNC_CLOCK_TOLERANCE_SECONDS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_CLOCK_TOLERANCE_SECONDS;
}

// ── body size ────────────────────────────────────────────────────────────────

// Real dealer payloads are a few KB. 256KB is an order of magnitude of
// headroom, enough that no legitimate Connect payload can ever hit it.
const MAX_BODY_BYTES = 256 * 1024;

// ── rate limiting (house pattern, ported from the geocode controller) ────────

// The geocode controller (backend/src/api/geocode/controllers/geocode.ts) is
// the house in-memory limiter: a rolling window of hit timestamps per key, a
// hard cap on map size with oldest-inserted eviction, and a prune timer that
// runs off the request path. This route reuses that shape verbatim rather than
// inventing a third pattern. The dealer-enquiry limiter's DB-backed variant
// does not port: a Next route has no Strapi DB handle, and nothing here needs
// to persist across processes — the webhook has exactly one legitimate caller.
//
// 20/min with a 60s window: Connect's own sender caps itself at 10/min, so 20
// leaves headroom for that plus manual curl tests from the same IP while still
// bounding a flood. The key is the client IP in memory only — nothing is
// persisted, so the enquiry route's hashed-key concern does not apply here.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_IP = 20;
const IP_MAP_MAX = 5000;
const IP_PRUNE_MS = 60_000;

const ipHits = new Map<string, number[]>();

/** Drops IP buckets with no hits inside the window. Runs on a timer, never on a request. */
function pruneIpHits(): void {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [k, times] of ipHits) {
    if (!times.length || times[times.length - 1] < cutoff) ipHits.delete(k);
  }
}

// unref so this timer can never hold the process open on shutdown.
const pruneTimer = setInterval(pruneIpHits, IP_PRUNE_MS);
if (typeof pruneTimer.unref === "function") pruneTimer.unref();

/** True when this IP has spent its allowance. O(1) amortised. */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  const recent = (ipHits.get(key) ?? []).filter((t) => t >= cutoff);
  if (recent.length >= RATE_LIMIT_PER_IP) {
    ipHits.set(key, recent);
    return true;
  }
  recent.push(now);

  // Refresh insertion order so an active IP is not the next one evicted.
  ipHits.delete(key);
  ipHits.set(key, recent);

  // Hard cap, evicting oldest-inserted first. Unlike a window-based prune this
  // always makes room, so a flood of fresh IPs cannot grow the map.
  while (ipHits.size > IP_MAP_MAX) {
    const oldest = ipHits.keys().next();
    if (oldest.done) break;
    ipHits.delete(oldest.value);
  }
  return false;
}

/**
 * Client IP for rate limiting. Ploi's nginx overwrites X-Forwarded-For (same
 * precondition the backend's hashIp documents), so the first entry is the
 * caller. "unknown" is its own bucket: an address-less caller shares one
 * allowance instead of getting an uncounted bypass.
 */
function clientIpKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// ── sweep trigger ────────────────────────────────────────────────────────────

/**
 * POSTs the Strapi integration sweep. Never throws: every failure mode resolves
 * to a static outcome string the route logs. No timeout is left unbounded — the
 * sweep does a full outbound read of Connect's feed, so it can take a while,
 * but the receiver must not hold Connect's connection open for that; 20s
 * matches the sender's own HTTP timeout.
 */
async function triggerDealerSweep(
  token: string | undefined,
): Promise<"triggered" | "no-token" | "error" | `http-${number}`> {
  if (!token) return "no-token";
  try {
    const response = await fetch(`${STRAPI_URL}/api/integrations/dealers/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // The sweep writes every dealer row; a cached answer would be worse than
      // useless. POST is not cached by default, but this states the intent.
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return "triggered";
    return `http-${response.status}` as const;
  } catch {
    return "error";
  }
}

// ── the route ────────────────────────────────────────────────────────────────

type Failure = { status: 401 | 413 | 429; log?: string };

function reject({ status, log }: Failure): NextResponse {
  if (log) console.info(`[connect-sync] ${log}`);
  // The response body carries nothing but the status: no reason strings, no
  // headers echoed back. Connect treats any 4xx as a failed attempt without an
  // immediate HTTP retry (its queue still re-attempts up to 3), and 401 here is
  // deliberately NOT 503 — 503 is the one status its HTTP client hammers.
  return NextResponse.json({ received: false }, { status });
}

export async function POST(request: NextRequest) {
  // Unset secret refuses everything — dormant is the correct closed default.
  // The only cost is that Connect's queue exhausts its 3 attempts and records a
  // warning on their side, which is exactly what "receiver not switched on"
  // should look like.
  const secret = connectSecret();
  if (!secret) {
    return reject({ status: 401, log: "rejected: no secret configured" });
  }

  // Rate limit BEFORE the body is read: the caller is unverified at this point,
  // so nothing they send should be spent on.
  const ipKey = clientIpKey(request);
  if (isRateLimited(ipKey)) {
    return reject({ status: 429, log: "rejected: rate-limited" });
  }

  // Size cap before reading. The Content-Length check is the cheap rejection;
  // the post-read byte count is the belt-and-braces case for a caller (or
  // proxy) that lies about or omits the header. req.text() buffers whatever
  // arrives either way — there is no incremental cap on a Route Handler's
  // text() — so the post-check bounds what happens next, not what was buffered.
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return reject({ status: 413, log: "rejected: oversized (content-length)" });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return reject({ status: 413, log: "rejected: oversized (actual bytes)" });
  }

  const check = verifyConnectSignature(
    rawBody,
    request.headers.get("x-caravea-timestamp"),
    request.headers.get("x-caravea-signature"),
    secret,
    { toleranceSeconds: clockToleranceSeconds() },
  );
  if (!check.ok) {
    return reject({ status: 401, log: `rejected: ${check.reason}` });
  }

  // Verified. From here the delivery is accepted no matter what: parse only to
  // log, trigger the sweep best-effort, invalidate the cache, answer 200.
  const summary = parseEventSummary(rawBody);
  const event = summary?.event ?? "(unparsed)";
  const companyId = summary?.caraveaCompanyId ?? "(absent)";

  const sweep = await triggerDealerSweep(process.env.STRAPI_API_TOKEN);

  let revalidated = false;
  try {
    // Next 16 requires the second argument (TS2554 otherwise). { expire: 0 }
    // is the full purge — a named profile would keep serving the old dealer
    // list for that profile's window, the same reasoning as /api/revalidate.
    revalidateTag(DEALERS_TAG, { expire: 0 });
    revalidated = true;
  } catch {
    // Leave revalidated false and keep the 200: the data cache still expires
    // on its own 60s window, and a throw here must not turn a verified
    // delivery into a 5xx the sender retries pointlessly.
  }

  console.info(
    `[connect-sync] event=${event} company=${companyId} sweep=${sweep} revalidated=${revalidated}`,
  );
  return NextResponse.json({ received: true });
}