# Production cutover: /find-dealer, the Connect dealer cache and the coordinates

One-off runbook for the first `staging -> main` merge that carries the dealer directory. Everything
here was measured against the live box. Delete this file once the cutover is done.

`docs/deploy/*.sh` still owns the routine deploy. This covers only what is different about *this*
release.

**Revised 2026-08-21 for ETN-013 (PR #65).** That PR changed the architecture after this runbook was
first written, and the env-var step in particular was left dangerously wrong. If you are holding a
copy that tells you to put `CONNECT_API_URL` on the frontend, throw it away and read step 2 below.

## What this release changes on production

Production has never had any of it: `/find-dealer` currently 404s and `cms.nobettertime.com.au/api/dealers`
404s with it.

- **`/find-dealer` reads a Strapi CACHE of Connect's dealer feed**, not Connect directly. A cron
  sweep in Strapi pulls the feed, resolves each dealer's best map pin, and writes a `dealer` row.
  The frontend only ever talks to Strapi. There is deliberately no live-Connect fallback: last-good
  or nothing.
- Two new Strapi collections, `dealer` and `integration-setting`, plus six coordinate columns on the
  existing `dealer_submissions` and the pin the dealer places on the onboarding form.
- The homepage's restored TrustBar / LifestyleBand / hero search, the header's Find a Dealer nav
  link, and the participating-state narrowing (NSW, VIC, QLD).

### How a map pin actually reaches the page

Worth understanding before you debug a missing pin, because it is a three-hop chain:

```
dealer_submissions.latitude   (onboarding form pin, or the seed backfill in step 4)
        +  Connect's own coordinate (always approximate)
                -> the sync ranks the candidates and picks the most trusted
                        -> dealer.latitude  (the cache)
                                -> GET /api/dealers -> the map
```

A pin on `dealer_submissions` still reaches the public map, by that longer route. That is why the
coordinate backfill in step 4 matters even though the page no longer reads that table.

## Release gates

1. **Connect credentials for production do not exist yet.** Verified 2026-08-21: prod's
   `backend/.env` has **zero** `CONNECT_*` keys. The only pair that exists anywhere is the *staging*
   one, and production must not borrow it: it holds our test artifacts and lorem suburbs, and every
   key holder can read every NoBetterTime submission including PII. Without a production pair the
   sweep cannot run, the cache stays empty, and `/find-dealer` shows its "no dealers listed yet"
   panel.
2. **`NEXT_PUBLIC_MAPBOX_TOKEN` on production is still the 22-character placeholder.** Re-measured
   2026-08-21, still unchanged. Being `NEXT_PUBLIC_` it needs a full rebuild, not a restart. Step 6.
3. **`PR #64` must be merged into `staging` before `#43` goes to `main`.** It carries the 175-entry
   coordinate seed. Merge `#43` without it and the seed is still the old 142, so 33 dealers get
   Connect's approximate coordinate instead of their street pin, silently.

## Nothing to seed in the CMS

Checked by reading both APIs: production and staging return the **same `home-page` documentId with
identical field values**, and the same `header.menuItems` (four items, `ctaButton` null). Every
restored homepage section falls back to hardcoded content, and the Find a Dealer nav link is
prepended in code rather than read from `menuItems`, so it appears without a CMS edit.

So: **do not run any `seed:*` script against production, and do not transfer content from staging.**
There is no content gap to close. The only production data changes in this release are the coordinate
backfill (step 4) and the dealer cache the sweep fills (step 5).

## 1. Back up the production database first

Non-negotiable, because **rolling this release back is destructive**: reverting the code removes the
six coordinate columns from `dealer_submissions`, and Strapi drops them on the next sync. Restoring
means restoring this file, not reverting a commit. The two new collections go the same way.

`PRAGMA journal_mode` on production is `delete`, not WAL, and there are no `-wal`/`-shm` files, so a
plain `scp` is a valid point-in-time snapshot and writes nothing to the box.

```bash
# From your machine. Keep the copy off the server.
scp ploi@170.64.175.224:/home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
    ./prod-data.db.$(date +%Y%m%d-%H%M%S)

# Prove the copy is usable before trusting it.
sqlite3 ./prod-data.db.<stamp> 'PRAGMA integrity_check;'          # expect: ok
sqlite3 ./prod-data.db.<stamp> 'select count(*) from dealer_submissions;'
```

Also keep an on-box copy so a rollback does not depend on your laptop:

```bash
ssh ploi@170.64.175.224 'cd /home/ploi/cms.nobettertime.com.au/backend/.tmp \
  && cp data.db data.db.pre-find-dealer.$(date +%Y%m%d-%H%M%S)'
```

## 2. Place the environment variables

**This is the step ETN-013 changed. Four variables that an earlier draft of this runbook told you to
put on the frontend are no longer read there.**

### Backend, `/home/ploi/cms.nobettertime.com.au/backend/.env`

| Variable | Why |
| --- | --- |
| `CONNECT_API_URL` | The feed. Absent on prod today. |
| `CONNECT_API_KEY` | Same. Serves both the inbound push and this outbound read. |
| `CONNECT_SYNC_ENABLED=true` | **Defaults to `false`.** Leave it and no sweep is ever scheduled, so the cache stays empty and the directory is permanently blank with nothing in the logs to explain it. Compared lowercase against the literal `true`. |
| `CONNECT_SYNC_CRON` | Optional. Default is `*/10 * * * *`. |
| `REVALIDATE_URL` | Optional. The FRONTEND origin, so publishing a dealer shows immediately instead of within 60s. |
| `REVALIDATE_SECRET` | Optional, must match the frontend's exactly. |

`DO_SPACE_BUCKET` and `DO_SPACE_ROOT_PATH` are already present on prod's backend and are now the only
place they are needed. The trusted-media-URL check moved into the sync, so an untrusted URL is never
stored in the first place.

### Frontend, `/home/ploi/nobettertime.com.au/frontend/.env`

**Do NOT add `CONNECT_API_URL`, `CONNECT_API_KEY`, `DO_SPACE_BUCKET` or `DO_SPACE_ROOT_PATH` here.**
The frontend makes no requests to Connect at all any more, and setting them does nothing. What it
needs:

- `NEXT_PUBLIC_STRAPI_URL`: already set. This is now the only dealer source, so an unreachable
  Strapi is what produces the outage panel.
- `NEXT_PUBLIC_MAPBOX_TOKEN`: currently the placeholder. See step 6.
- `REVALIDATE_SECRET`: optional, must match the backend's. Unset means `POST /api/revalidate` 401s
  everything, which is the correct closed default; the only cost is waiting out the 60s window.

Back the file up before editing, and keep mode 600:

```bash
ssh ploi@170.64.175.224
cd /home/ploi/nobettertime.com.au/frontend
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
chmod 600 .env
```

None of the runtime vars is `NEXT_PUBLIC_`, so `pm2 restart <name> --update-env` is enough for them.
**Do not verify them through `/proc/<pid>/environ`**: Next loads `frontend/.env` itself after boot, so
they read as absent on a perfectly working process. Verify by fetching the page.

## 3. Deploy the backend before the frontend

Order matters: the backend deploy creates the `dealer` and `integration-setting` tables, adds the six
coordinate columns, and runs the backfill. The frontend has nothing to read until it has.

The production backend deploy script already does the two things this release needs
(`npm run clean --workspace=backend` before building, so the deleted content types do not linger in
`dist/`, and `ts:generate-types`, so the git-ignored generated types are not stale). No script change
required.

## 4. The coordinate backfill runs itself. Check that it did.

Production has **183 `dealer_submissions` rows and no coordinate columns** (measured 2026-08-21). On
the first backend boot after this deploy, Strapi's schema sync adds the six columns and then
`bootstrap` fills them from `backend/src/utils/dealer-coordinates.seed.json` (**175 entries**). It is
flag-guarded in the core store, so it runs once per database, and it only ever fills NULLs.

All 175 seed documentIds exist on production, so the expected log line is:

```bash
ssh ploi@170.64.175.224 'pm2 logs cms-escapethenoise-tempcaraveadev --lines 200 --nostream' \
  | grep 'dealer coordinates'
# expect: [bootstrap] dealer coordinates: 175 placed / 0 already set / 0 no matching dealer
```

A `warn` instead of `info` means fewer than 175 landed. Do not shrug it off: an unpinned dealer
silently falls back to a coarser coordinate. Confirm with:

```bash
ssh ploi@170.64.175.224 'sqlite3 -readonly \
  /home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
  "select count(*) from dealer_submissions where latitude is not null;"'   # expect 175
```

**8 rows will still have no pin, and that is expected.** Five are permanent: their addresses are
corrupt or fictional and no geocoder will resolve them until a human fixes the source data. They are
All Brand Caravan Services (`SANDGATE DC;QLD`), Capricorn Caravan Centre (`Park Avenue North
Rockhampton`, two suburbs mashed together), Main Event RV Townsville (`Twonsville`), Cannington RV
Centre (`Becknham`), and the `Caravea DEv` lorem-ipsum test record, which wants deleting rather than
fixing. The other three arrived on 20 Aug, after the seed snapshot, and step 7 picks them up:
Newcastle RV Super Centre (Beresfield NSW), Luxury Rvs Queensland (Yandina QLD) and Fantasy
Caravan-Coopers Plains (Coopers Plains QLD).

## 5. Turn the sweep on and trigger it once by hand

There are **three** independent guards, and knowing which is which saves an hour of confusion:

| Guard | Where | Default | Effect when off |
| --- | --- | --- | --- |
| `CONNECT_SYNC_ENABLED` | server `backend/.env`, read by `config/server.ts` as `cron.enabled` | **`false`** | The cron task is never even registered. |
| the same var, re-checked | `config/cron-tasks.ts` | same | The scheduled task no-ops. |
| `connectSyncEnabled` | `Integration Setting` single type, in the database | **`true`** | `runDealerSync` returns `disabled`. Lets an admin stop the sweep with no deploy. |

The DB flag defaults to `true`, so on a fresh production it will not be in your way. The env var
defaults to `false`, so it will.

Cron runs every 10 minutes, but do not sit and wait to find out whether it works. There is an
authenticated manual trigger, and usefully it **only passes through the third guard**, so you can
prove the credentials work before you turn cron on at all:

```bash
# CMS admin: Settings > API Tokens > Full access, short lifespan.
curl -X POST https://cms.nobettertime.com.au/api/integrations/dealers/sync \
  -H "Authorization: Bearer <token>"
# then DELETE the token in the admin
```

It returns **200 either way** with the outcome in the body, so read `status` and `errors` rather than
trusting the HTTP code. `status: "disabled"` means the DB flag; a failure on the first rail means the
credentials.

The route deliberately has no `auth: false`, so it needs that token: it drives a full outbound read of
Connect's feed using our shared key and writes to every dealer row.

Then read the outcome, which the sweep records rather than only logging:

```bash
ssh ploi@170.64.175.224 'sqlite3 -readonly \
  /home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
  "select last_sync_at, last_sync_status, last_sync_summary from integration_settings;"'
```

Two behaviours to know before you interpret what you see:

- **New dealers arrive PUBLISHED** (ETN-013 D1), so the directory is complete with nobody tending it.
  The accepted consequence is that **a Connect test or lorem row goes live until someone hides it**,
  and hiding it is then permanent, because the sweep never republishes. Connect's own test records
  are still unresolved, so expect to hide a few.
- **Unpublishing is the hide switch and it sticks.** The sweep keeps updating a hidden dealer's draft
  so publishing them later shows current data, but it never flips them back to published.

## 6. Mapbox token, then a real rebuild

After replacing the placeholder token in `frontend/.env`, a plain redeploy is not enough.
`NEXT_PUBLIC_*` values are inlined at build time and the webpack cache holds the old value already
inlined into cached modules. The tell-tale is a suspiciously fast "Compiled successfully in ~3s".

```bash
ssh ploi@170.64.175.224
cd /home/ploi/nobettertime.com.au
rm -rf frontend/.next          # the whole directory, not just .next/cache
npm run build --workspace=frontend
export PORT=3004
pm2 restart escapethenoise-tempcaraveadev --update-env
```

## 7. Top up any dealer who submitted between the seed snapshot and the deploy

The seed is a snapshot taken on 2026-08-20 at 180 rows; production is already 183 and grows by a few
a week. A dealer who submits before this release goes out gets no pin, because the self-pin field is
not deployed yet, and they are not in the seed either. After the release, new submissions carry their
own pin and no top-up is needed. So this is a one-off, sized by however long the merge takes.

```bash
ssh ploi@170.64.175.224 'sqlite3 -readonly \
  /home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
  "select count(*) from dealer_submissions where latitude is null;"'
```

Expect 8 as of 2026-08-21 (5 permanent misses plus the 3 named in step 4). Anything higher is a newer
arrival. Fill the gap with the backstop script, which finds rows with no latitude and geocodes their
street address:

```bash
cd backend
STRAPI_URL=https://cms.nobettertime.com.au STRAPI_TOKEN=<token> \
  npm run seed:dealer-geo -- --dry     # read the plan first
STRAPI_URL=https://cms.nobettertime.com.au STRAPI_TOKEN=<token> \
  npm run seed:dealer-geo
# then DELETE the token in the admin
```

Never pass `--overwrite`. It clobbers dealer-placed and staff-corrected pins, and provenance is a
private field so the script cannot tell a guess from a correction. The default run only fills gaps.

Nominatim is rate-limited to 1 request/second process-wide, so a large gap takes a while. That limit
is policy, not tuning. Do not raise it, and do not swap in Mapbox geocoding: its standard Geocoding
API forbids storing the results.

**Re-run the sync from step 5 afterwards**, or the new pins sit in `dealer_submissions` and never
reach the cache the map reads.

## 8. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://nobettertime.com.au/find-dealer   # 200
curl -s 'https://cms.nobettertime.com.au/api/dealers'      | head -c 300          # published dealers
curl -s 'https://cms.nobettertime.com.au/api/dealer-counts'                        # per-state counts
curl -s https://cms.nobettertime.com.au/api/recaptcha-config                       # enabled:true
```

`/api/dealers` and `/api/dealer-counts` are both `auth: false`, so they need no Public-role
permission and none is granted in `bootstrap`. If they 403, something registered a core router over
them.

Then in a browser on `/find-dealer`:

- The dealer count in the subtitle matches the state tiles, and the tiles show only NSW, VIC and QLD.
- Map pins are spread across suburbs rather than stacked on postcode centres. Some genuine stacking
  is expected: several dealers legitimately share an address, and a handful of distinct businesses
  geocode to the same street centroid.
- A postcode search moves the camera, and "Near me" works.
- Open a dealer: the modal shows address, hours, services and brands. The enquiry form shows for
  every dealer since ETN-010.

An empty but honest page means the cache is empty, which is a Connect data or `CONNECT_SYNC_ENABLED`
question, not a deploy failure. Distinguish the two panels: "can't load the dealer directory" means
Strapi was unreachable; "none listed yet" means Strapi answered and held nothing published.

## Rollback

Restore the database backup from step 1. Reverting the merge alone loses the coordinates and both new
collections, because they go with the schema.
