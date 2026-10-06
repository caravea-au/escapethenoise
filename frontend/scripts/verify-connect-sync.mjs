// Verification script for the Connect push receiver's signature logic
// (src/lib/connect-sync.ts). The repo has no test runner configured (frontend
// package.json has no test framework), so ETN-018 ships this instead: plain
// `node scripts/verify-connect-sync.mjs` imports the TS module directly
// (Node 22.6+ type stripping; this repo runs Node 24) and asserts the
// behaviour the route depends on. Run it from frontend/ after any change to
// connect-sync.ts. Exit 0 = all cases pass.
//
// The script covers the signature contract in
// docs/nobettertime-staging-connect.md ("OUTBOUND"): HMAC-SHA256 over
// `<X-Caravea-Timestamp> + "\n" + <exact raw body>` keyed with the shared
// secret, header `sha256=<lowercase hex>`, timestamps inside a tolerance
// window.

import assert from "node:assert/strict";
import {
  DEFAULT_CLOCK_TOLERANCE_SECONDS,
  parseEventSummary,
  verifyConnectSignature,
} from "../src/lib/connect-sync.ts";

// ── fixtures ─────────────────────────────────────────────────────────────────

const SECRET = "shared-secret-for-tests";
const BODY = JSON.stringify({
  version: 1,
  event: "dealer.approved",
  company: { caravea_company_id: "caraveacomp|AbCd1234", status: "approved" },
});
const ISO_NOW = "2026-08-14T12:00:00+00:00";
// Fixed "now" so every case is deterministic and no test can flake on clock
// drift between the header it builds and the moment it runs.
const NOW_MS = Date.parse(ISO_NOW);

async function hmacHex(timestamp, body, key = SECRET) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", key).update(`${timestamp}\n${body}`).digest("hex");
}

function check(body, timestamp, signature, key = SECRET, options = {}) {
  return verifyConnectSignature(body, timestamp, signature, key, {
    nowMs: NOW_MS,
    ...options,
  });
}

let passed = 0;
const failures = [];

function expect(name, actual, predicate) {
  try {
    predicate(actual);
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  FAIL ${name}`);
  }
}

// ── signature cases ──────────────────────────────────────────────────────────

console.log("verifyConnectSignature");

const validSignature = await hmacHex(ISO_NOW, BODY);

expect("valid signature passes", check(BODY, ISO_NOW, `sha256=${validSignature}`), (r) =>
  assert.deepEqual(r, { ok: true }),
);

expect(
  "wrong key fails with bad-signature",
  check(BODY, ISO_NOW, `sha256=${await hmacHex(ISO_NOW, BODY, "attacker-key")}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "bad-signature" }),
);

expect(
  "tampered body fails with bad-signature",
  check(BODY + " ", ISO_NOW, `sha256=${validSignature}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "bad-signature" }),
);

// The contract signs the exact bytes on the wire: pretty-printing or re-encoding
// the body must break the signature.
expect(
  "re-encoded body (pretty-printed) fails",
  check(JSON.stringify(JSON.parse(BODY), null, 2), ISO_NOW, `sha256=${validSignature}`),
  (r) => assert.equal(r.ok, false),
);

expect(
  "missing sha256= prefix fails with malformed-signature",
  check(BODY, ISO_NOW, validSignature),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-signature" }),
);

expect(
  "uppercase hex fails with malformed-signature",
  check(BODY, ISO_NOW, `sha256=${validSignature.toUpperCase()}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-signature" }),
);

expect(
  "truncated hex fails with malformed-signature",
  check(BODY, ISO_NOW, `sha256=${validSignature.slice(0, 63)}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-signature" }),
);

expect(
  "missing signature header fails with malformed-signature",
  check(BODY, ISO_NOW, null),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-signature" }),
);

expect(
  "unset secret fails closed with missing-secret",
  verifyConnectSignature(BODY, ISO_NOW, `sha256=${validSignature}`, undefined, { nowMs: NOW_MS }),
  (r) => assert.deepEqual(r, { ok: false, reason: "missing-secret" }),
);

expect(
  "blank secret fails closed with missing-secret",
  check(BODY, ISO_NOW, `sha256=${validSignature}`, ""),
  (r) => assert.deepEqual(r, { ok: false, reason: "missing-secret" }),
);

// ── timestamp cases ──────────────────────────────────────────────────────────

expect(
  "stale timestamp (older than window) fails",
  check(BODY, "2026-08-14T11:00:00+00:00", `sha256=${await hmacHex("2026-08-14T11:00:00+00:00", BODY)}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "stale-timestamp" }),
);

expect(
  "future timestamp beyond window fails",
  check(BODY, "2026-08-14T12:16:00+00:00", `sha256=${await hmacHex("2026-08-14T12:16:00+00:00", BODY)}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "stale-timestamp" }),
);

expect(
  "bare date is not a valid webhook timestamp",
  check(BODY, "2026-08-14", `sha256=${validSignature}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-timestamp" }),
);

expect(
  "impossible calendar date fails (V8 rolls it over, landing outside the window)",
  check(BODY, "2026-02-30T12:00:00+00:00", `sha256=${validSignature}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "stale-timestamp" }),
);

expect(
  "missing timestamp header fails",
  check(BODY, null, `sha256=${validSignature}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "malformed-timestamp" }),
);

// Window edges: exactly at the tolerance boundary passes; 1s beyond fails.
const edgeOld = "2026-08-14T11:45:00+00:00";
const edgeNew = "2026-08-14T12:15:00+00:00";
expect(
  "timestamp exactly 900s old passes (sender's longest backoff)",
  check(BODY, edgeOld, `sha256=${await hmacHex(edgeOld, BODY)}`),
  (r) => assert.deepEqual(r, { ok: true }),
);
expect(
  "timestamp exactly 900s ahead passes",
  check(BODY, edgeNew, `sha256=${await hmacHex(edgeNew, BODY)}`),
  (r) => assert.deepEqual(r, { ok: true }),
);
expect(
  "timestamp 901s old fails",
  check(BODY, "2026-08-14T11:44:59+00:00", `sha256=${await hmacHex("2026-08-14T11:44:59+00:00", BODY)}`),
  (r) => assert.deepEqual(r, { ok: false, reason: "stale-timestamp" }),
);

// ── replay and tolerance override ────────────────────────────────────────────

// Replay of the same delivery inside the window: the receiver is stateless and
// treats deliveries as idempotent (the docs ask exactly this), so a replayed
// correctly-signed event passes and re-triggers the same sweep.
expect(
  "replay inside window passes",
  check(BODY, ISO_NOW, `sha256=${validSignature}`),
  (r) => assert.deepEqual(r, { ok: true }),
);

expect(
  "env tolerance override shortens the accepted window",
  check(BODY, edgeOld, `sha256=${await hmacHex(edgeOld, BODY)}`, SECRET, { toleranceSeconds: 60 }),
  (r) => assert.deepEqual(r, { ok: false, reason: "stale-timestamp" }),
);

expect(
  "default tolerance is the sender's longest backoff (900s)",
  DEFAULT_CLOCK_TOLERANCE_SECONDS,
  (v) => assert.equal(v, 900),
);

// ── event summary parsing ────────────────────────────────────────────────────

console.log("parseEventSummary");

expect(
  "extracts event and caravea_company_id",
  parseEventSummary(BODY),
  (s) => assert.deepEqual(s, { event: "dealer.approved", caraveaCompanyId: "caraveacomp|AbCd1234" }),
);

expect(
  "suspended event and absent company parse",
  parseEventSummary(JSON.stringify({ event: "dealer.suspended" })),
  (s) => assert.deepEqual(s, { event: "dealer.suspended", caraveaCompanyId: null }),
);

expect(
  "unparseable body returns null (never throws)",
  parseEventSummary("this is not json"),
  (s) => assert.equal(s, null),
);

expect(
  "non-object JSON returns null",
  parseEventSummary("12345"),
  (s) => assert.equal(s, null),
);

expect(
  "unexpected shapes log placeholders instead of payload data",
  parseEventSummary(JSON.stringify({ event: { sneaky: "x" }, company: "oops" })),
  (s) => assert.deepEqual(s, { event: "(unrecognised)", caraveaCompanyId: null }),
);

expect(
  "control characters are stripped from log values",
  parseEventSummary(JSON.stringify({ event: "dealer.approved\nINJECTED", company: { caravea_company_id: "id\x1B[31m" } })),
  (s) => assert.deepEqual(s, { event: "dealer.approved INJECTED", caraveaCompanyId: "id [31m" }),
);

// ── result ───────────────────────────────────────────────────────────────────

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} FAILED, ${passed} passed`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`All ${passed} checks passed.`);