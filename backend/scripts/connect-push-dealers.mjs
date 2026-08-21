// Backfills Caravea Connect with the dealer-submission rows that already
// live in production Strapi, so Connect ends up holding the same dealers
// nobettertime.com.au already lists. Every row is mapped/gated by the SAME
// implementation the dealer-submission lifecycle uses — this script never
// re-implements `toConnectRegistration` / `shouldPushToConnect`; it POSTs
// each row to `POST /api/connect/push` (backend/src/api/connect/) and that
// route owns the mapping.
//
//   LIVE_STRAPI_TOKEN=... STRAPI_TOKEN=... npm run connect:push -- --dry
//   LIVE_STRAPI_TOKEN=... STRAPI_TOKEN=... npm run connect:push -- --execute
//   LIVE_STRAPI_TOKEN=... STRAPI_TOKEN=... npm run connect:push -- --execute --force
//
// (from backend/, local Strapi running, CONNECT_API_URL/CONNECT_API_KEY set
// in its .env)
//
// Exactly one of --dry / --execute is required — there is no default, and no
// flags at all is a hard usage error. A real push is NEVER the default
// behaviour: Connect's 201 carries no identity key, so a real push cannot be
// undone, and an operator who mistypes "--dry-run"/"--dryrun"/"-d" must get an
// error, not a silent real push. --force additionally requires --execute (it
// has no effect combined with --dry). Any other --flag is also a hard error.
//
// Pipeline:
//   1. GET  {LIVE_STRAPI_URL}/api/dealer-submissions  — 2 pages, sort=id:asc
//      (mandatory: without it rows can repeat or vanish across pages).
//      Asserts the collected count against meta.pagination.total.
//   2. GET  {STRAPI_URL}/api/dealers                  — local pins, unpaginated
//      (findPublic bypasses core find's pagination cap). Indexed by documentId
//      — the ONLY source of coordinates; live prod has no coordinate columns.
//   3. Merge latitude/longitude/precision onto the live rows by documentId.
//   4. Geocode whichever live row(s) have no local match via
//      POST {STRAPI_URL}/api/geocode-address/resolve. A 429 with
//      code:"rate-limited" is retried with backoff, never counted as a miss.
//   5. Exclude the "Caravea DEv" lorem-ipsum test record.
//   6. POST {STRAPI_URL}/api/connect/push in batches of <=50, paced ~1 req/s
//      between batches.
//   7. Sidecar state file backend/.tmp/connect-push-state.json maps
//      documentId -> {status, at}. Connect's payload carries no dealer
//      identity key and its 201 is byte-identical every time, so this file is
//      the ONLY thing making a re-run resumable and non-duplicating. A full
//      re-run is refused when the state file already shows "pushed" rows,
//      unless --force is passed. `--dry` never touches this file.
//   8. Report to backend/.tmp/connect-push-report.json: documentId,
//      dealershipName, status, reason ONLY — never a payload field, never
//      Connect's error body. The live rows carry ABN, motor dealer licence
//      numbers and submitter contact details; both files live under .tmp/,
//      which is already gitignored.
//
// Sanity-check the summary rather than matching a hardcoded total: live grows.
// It went 163 -> 165 during the build of this script, as three dealers
// registered overnight. The invariants that must hold on every run:
//
//   pushed + skipped + excluded            === live meta.pagination.total
//   pushedWithCoords + pushedWithoutCoords === pushed
//
// "without coordinates" should stay at 4 — the known bad-address rows
// (Twonsville / SANDGATE DC;QLD / Becknham / Park Avenue North Rockhampton).
// A jump there means new rows failed to geocode and needs a look, not a retry.
// "skipped" is dealers with no logo or no photos, which Connect requires.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 127.0.0.1, not localhost: Node's fetch resolves localhost to ::1 first and
// Strapi binds IPv4 only, which fails with an opaque ECONNREFUSED.
const LIVE_STRAPI_URL = (process.env.LIVE_STRAPI_URL ?? "https://cms.nobettertime.com.au").replace(/\/+$/, "");
const LIVE_STRAPI_TOKEN = process.env.LIVE_STRAPI_TOKEN ?? "";
const STRAPI_URL = (process.env.STRAPI_URL ?? "http://127.0.0.1:1337").replace(/\/+$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN ?? "";

const ACCEPTED_FLAGS = new Set(["--dry", "--force", "--execute"]);
const argv = process.argv.slice(2);

for (const arg of argv) {
  if (arg.startsWith("--") && !ACCEPTED_FLAGS.has(arg)) {
    console.error(
      `Unrecognised flag: ${arg}\n` +
        `Accepted flags: --dry, --execute, --force (--force only combined with --execute).`,
    );
    process.exit(1);
  }
}

const DRY = argv.includes("--dry");
const EXECUTE = argv.includes("--execute");
const FORCE = argv.includes("--force");

if (DRY === EXECUTE) {
  // Either both false (no flags — the historical, dangerous default) or both
  // true (contradictory). Neither is allowed: a real push always requires an
  // explicit, unambiguous --execute.
  console.error(
    "Usage: connect-push-dealers.mjs (--dry | --execute [--force])\n" +
      "Exactly one of --dry or --execute is required. There is no default — " +
      "omitting both is refused rather than treated as a real push.",
  );
  process.exit(1);
}

if (!LIVE_STRAPI_TOKEN) {
  console.error("LIVE_STRAPI_TOKEN is required (a token with dealer-submission `find` on live prod).");
  process.exit(1);
}
if (!STRAPI_TOKEN) {
  console.error("STRAPI_TOKEN is required (a full-access local API token — geocode + connect/push both need it).");
  process.exit(1);
}

const STATE_FILE = path.join(__dirname, "..", ".tmp", "connect-push-state.json");
const REPORT_FILE = path.join(__dirname, "..", ".tmp", "connect-push-report.json");

// The one dealer excluded from every run: a lorem-ipsum test record, not a
// real dealership.
const EXCLUDED_NAME = "Caravea DEv";

const PAGE_SIZE = 100;
const PUSH_BATCH_SIZE = 50;
const PUSH_PACE_MS = 1000;
const RATE_LIMIT_BACKOFF_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── state (resumability) ──────────────────────────────────────────────────────

function loadState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    console.error(`Could not parse ${STATE_FILE} — refusing to guess. Fix or delete it and retry.`);
    process.exit(1);
  }
}

function saveState(state) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = loadState();
const alreadyPushed = new Set(
  Object.entries(state)
    .filter(([, v]) => v?.status === "pushed")
    .map(([documentId]) => documentId),
);

if (alreadyPushed.size > 0 && !FORCE) {
  console.error(
    `${alreadyPushed.size} dealer(s) already show status "pushed" in ${STATE_FILE}.\n` +
      `Refusing a full re-run without --force — Connect's 201 is not idempotent, so a second push ` +
      `would create a duplicate submission for every row already sent. Pass --force to proceed ` +
      `(rows already marked "pushed" are still skipped; only the rest are sent).`,
  );
  process.exit(1);
}

// ── 1. live rows ───────────────────────────────────────────────────────────────

async function fetchLiveRows() {
  const headers = { Authorization: `Bearer ${LIVE_STRAPI_TOKEN}` };
  const rows = [];
  let page = 1;
  let total = null;

  for (;;) {
    const url =
      `${LIVE_STRAPI_URL}/api/dealer-submissions?pagination[pageSize]=${PAGE_SIZE}` +
      `&pagination[page]=${page}&sort=id:asc`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`GET ${url} failed: ${res.status}. Is LIVE_STRAPI_TOKEN valid and does it have dealer-submission find?`);
      process.exit(1);
    }
    const body = await res.json();
    const pageRows = body?.data ?? [];
    rows.push(...pageRows);
    total = body?.meta?.pagination?.total ?? total;

    if (pageRows.length === 0 || rows.length >= (total ?? Infinity)) break;
    page += 1;
  }

  if (total === null || rows.length !== total) {
    console.error(
      `Live row count mismatch: collected ${rows.length}, meta.pagination.total reports ${total}. ` +
        `Aborting — sort=id:asc is required and a mismatch here means the fetch is unreliable.`,
    );
    process.exit(1);
  }

  return rows;
}

// ── 2. local pins ────────────────────────────────────────────────────────────────

async function fetchLocalPins() {
  const res = await fetch(`${STRAPI_URL}/api/dealers`);
  if (!res.ok) {
    console.error(`GET ${STRAPI_URL}/api/dealers failed: ${res.status}. Is local Strapi running?`);
    process.exit(1);
  }
  const body = await res.json();
  const byDocumentId = new Map();
  for (const d of body?.data ?? []) {
    byDocumentId.set(d.documentId, d);
  }
  return byDocumentId;
}

// ── 4. geocode gaps ────────────────────────────────────────────────────────────

async function resolveGap(row) {
  const headers = {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    "Content-Type": "application/json",
  };

  for (;;) {
    const res = await fetch(`${STRAPI_URL}/api/geocode-address/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          street: row.street,
          suburb: row.suburb,
          state: row.state,
          postcode: row.postcode,
        },
      }),
    });

    if (res.status === 429) {
      console.log(`  ${(row.dealershipName ?? row.documentId).slice(0, 40)} rate-limited, retrying...`);
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }

    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  }
}

// ── run ────────────────────────────────────────────────────────────────────────

console.log(`Fetching live rows from ${LIVE_STRAPI_URL} ...`);
const liveRows = await fetchLiveRows();
console.log(`  ${liveRows.length} live rows.`);

console.log(`Fetching local pins from ${STRAPI_URL} ...`);
const localPins = await fetchLocalPins();
console.log(`  ${localPins.size} local dealer(s) available for coordinate merge.`);

let excluded = 0;
const merged = [];
const gaps = [];

for (const row of liveRows) {
  if ((row.dealershipName ?? "").trim() === EXCLUDED_NAME) {
    excluded += 1;
    continue;
  }

  const pin = localPins.get(row.documentId);
  if (pin && Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)) {
    row.latitude = pin.latitude;
    row.longitude = pin.longitude;
    row.precision = pin.precision;
  } else {
    gaps.push(row);
  }

  merged.push(row);
}

console.log(
  `  ${merged.length - gaps.length} of ${merged.length} matched a local pin. ${gaps.length} gap(s) to geocode.`,
);

for (const row of gaps) {
  const hit = await resolveGap(row);
  const name = (row.dealershipName ?? row.documentId).slice(0, 40);
  if (hit) {
    row.latitude = hit.lat;
    row.longitude = hit.lng;
    row.precision = hit.precision;
    console.log(`  geocoded ${name} -> ${hit.lat},${hit.lng} (${hit.precision})`);
  } else {
    console.log(`  ${name}: no geocode result, will push without coordinates.`);
  }
}

const hasCoords = (row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude);

let eligibleWithCoords = 0;
let eligibleWithoutCoords = 0;
for (const row of merged) {
  if (hasCoords(row)) eligibleWithCoords += 1;
  else eligibleWithoutCoords += 1;
}

console.log(
  `\n${merged.length} row(s) eligible (${excluded} excluded) — ${eligibleWithCoords} with coordinates, ${eligibleWithoutCoords} without.\n`,
);

// ── 6. push in batches ───────────────────────────────────────────────────────────

const toSend = merged.filter((row) => !alreadyPushed.has(row.documentId));
const resumedSkip = merged.length - toSend.length;
if (resumedSkip > 0) {
  console.log(`${resumedSkip} row(s) already marked "pushed" in the state file — resuming, not re-sending.\n`);
}

let pushed = 0;
let pushedWithCoords = 0;
let pushedWithoutCoords = 0;
let skippedMissingMedia = 0;
let failed = 0;
let errored = 0;
const report = [];

for (let i = 0; i < toSend.length; i += PUSH_BATCH_SIZE) {
  const batch = toSend.slice(i, i + PUSH_BATCH_SIZE);
  const batchLabel = `batch ${Math.floor(i / PUSH_BATCH_SIZE) + 1}`;

  const res = await fetch(`${STRAPI_URL}/api/connect/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRAPI_TOKEN}`,
      "Content-Type": "application/json",
    },
    // dryRun asks the route to run the same mapper/gate and stop short of the
    // real Connect POST — this script never re-implements that logic itself.
    body: JSON.stringify({ data: batch, dryRun: DRY }),
  });

  if (!res.ok) {
    // Never echo the response body: a non-OK from our own route can be a
    // dev-mode Strapi 500 whose body carries an internal error message and
    // stack trace. Status code only.
    console.log(`${batchLabel}: HTTP ${res.status} — request failed, see Strapi server logs for detail.`);
    for (const row of batch) {
      errored += 1;
      report.push({
        documentId: row.documentId,
        dealershipName: row.dealershipName ?? null,
        status: "error",
        reason: `http-${res.status}`,
      });
    }
    continue;
  }

  const body = await res.json();
  for (const outcome of body?.data ?? []) {
    const row = batch.find((r) => r.documentId === outcome.documentId);
    const name = row?.dealershipName ?? null;

    report.push({
      documentId: outcome.documentId,
      dealershipName: name,
      status: outcome.status,
      reason: outcome.reason ?? null,
    });

    if (!DRY) {
      state[outcome.documentId] = { status: outcome.status, at: new Date().toISOString() };
    }

    if (outcome.status === "pushed" || outcome.status === "would-push") {
      pushed += 1;
      // Count coordinates over the rows that actually went, not over every
      // eligible row: a skipped row still has a pin, so mixing the two
      // denominators makes the summary fail its own arithmetic.
      if (row && hasCoords(row)) pushedWithCoords += 1;
      else pushedWithoutCoords += 1;
    } else if (outcome.status === "skipped") skippedMissingMedia += 1;
    else if (outcome.status === "failed") failed += 1;
    else errored += 1;

    const padded = String(name ?? outcome.documentId).slice(0, 32).padEnd(32);
    console.log(`${padded} ${outcome.status}${outcome.reason ? ` (${outcome.reason})` : ""}`);
  }

  if (!DRY) saveState(state);

  if (i + PUSH_BATCH_SIZE < toSend.length) await sleep(PUSH_PACE_MS);
}

mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

console.log(
  `\n${pushed} ${DRY ? "would push" : "pushed"} · ${pushedWithCoords} with coordinates · ${pushedWithoutCoords} without · ` +
    `${skippedMissingMedia} skipped (missing media) · ${excluded} excluded (test record)` +
    (failed ? ` · ${failed} failed` : "") +
    (errored ? ` · ${errored} errored` : "") +
    (DRY ? "  (dry run, nothing pushed and state file untouched)" : ""),
);
