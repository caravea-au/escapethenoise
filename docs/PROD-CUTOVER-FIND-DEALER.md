# Production cutover: /find-dealer, Connect and the dealer coordinates

One-off runbook for the first `staging -> main` merge that carries the dealer
directory. Written 2026-08-20, before the merge. Everything here was measured
against the live box, not assumed. Delete this file once the cutover is done.

`docs/deploy/*.sh` still owns the routine deploy. This covers only what is
different about *this* release.

## What this release changes on production

Production has never had any of it: `/find-dealer` currently 404s and
`cms.nobettertime.com.au/api/dealers` 404s with it.

- `/find-dealer` and its map, reading dealers from **Caravea Connect**, not from
  Strapi. There is no Strapi fallback: misconfigure Connect and the page renders
  its "can't load the dealer directory" panel with zero dealers.
- Six coordinate columns on `dealer_submissions`, plus the pin the dealer places
  on the onboarding form.
- The homepage's restored TrustBar / LifestyleBand / hero search, the header's
  Find a Dealer nav link, and the participating-state narrowing (NSW, VIC, QLD).

## Release gates, both hard

Neither is a code problem. Both are configuration on the box, and both were
verified missing on 2026-08-20.

1. **Connect credentials for production do not exist yet.** The only pair that
   exists anywhere is the *staging* one (`staging-connect-v3.caravea.au` plus a
   staging key). Production must not be pointed at it: staging Connect holds our
   test artifacts and lorem suburbs, and every key holder can read every
   NoBetterTime submission including PII. Wait for the production base URL and
   key. Until they are placed, `/find-dealer` is the outage panel.
2. **`NEXT_PUBLIC_MAPBOX_TOKEN` on production is still the 22-character
   placeholder.** Latent since August, invisible only because `/find-dealer`
   404s. It needs a real public token, and because it is `NEXT_PUBLIC_` it needs
   a full rebuild, not a restart. See step 6.

## Nothing to seed in the CMS

Checked on 2026-08-20 by reading both APIs: production and staging return the
**same `home-page` documentId with identical field values**, and the same
`header.menuItems` (four items, `ctaButton` null). Every restored homepage
section falls back to hardcoded content, and the Find a Dealer nav link is
prepended in code rather than read from `menuItems`, so it appears without a CMS
edit. `/find-dealer` reads Connect plus two committed datasets (the GeoNames
locality file and the postcode centroids) and fetches nothing from Strapi.

So: **do not run any `seed:*` script against production, and do not transfer
content from staging.** There is no content gap to close. The only production
data change in this release is the coordinate backfill in step 4.

## 1. Back up the production database first

Non-negotiable, because **rolling this release back is destructive**: reverting
the code removes the six coordinate columns from the schema, and Strapi drops
them on the next sync. Restoring means restoring this file, not reverting a
commit.

`PRAGMA journal_mode` on production is `delete`, not WAL, and there are no
`-wal`/`-shm` files, so a plain `scp` is a valid point-in-time snapshot and
writes nothing to the box.

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

**Backend** (`/home/ploi/cms.nobettertime.com.au/backend/.env`) has no `CONNECT_*`
at all. Add `CONNECT_API_URL` and `CONNECT_API_KEY`. Without them the dealer
enquiry endpoint cannot resolve a Connect dealer id and denies every enquiry, and
new submissions are never forwarded to Connect.

**Frontend** (`/home/ploi/nobettertime.com.au/frontend/.env`) is missing four:
`CONNECT_API_URL`, `CONNECT_API_KEY`, `DO_SPACE_BUCKET`, `DO_SPACE_ROOT_PATH`.
Production's backend already has the two `DO_SPACE_*` values, so **copy them
across rather than typing them**, or the pair drifts and every dealer image is
silently rejected:

```bash
ssh ploi@170.64.175.224
cd /home/ploi/nobettertime.com.au/frontend
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
grep -E '^(DO_SPACE_BUCKET|DO_SPACE_ROOT_PATH)=' \
  /home/ploi/cms.nobettertime.com.au/backend/.env >> .env
# then append CONNECT_API_URL / CONNECT_API_KEY from the vault
chmod 600 .env
```

Production's `DO_SPACE_ROOT_PATH` is `nobettertime`. Ignore
`docs/deploy/env.frontend.template`'s suggestion of a per-environment prefix:
staging uses `nobettertime` too, by choice.

None of the four is `NEXT_PUBLIC_`, so they are read at runtime and
`pm2 restart <name> --update-env` is enough. **Do not verify them through
`/proc/<pid>/environ`**: Next loads `frontend/.env` itself after boot, so all
four read as absent on a perfectly working process. Verify by fetching the page.

## 3. Deploy the backend before the frontend

Order matters: the backend deploy is what creates the coordinate columns and runs
the backfill, and the frontend's map expects them.

The production backend deploy script already does the two things this release
needs (`npm run clean --workspace=backend` before building, so the deleted
`dealer-geocode` type does not linger in `dist/`, and `ts:generate-types`, so the
git-ignored generated types are not stale). No script change required.

## 4. The coordinate backfill runs itself. Check that it did.

Production has **180 dealer submissions and no coordinate columns**. On the first
backend boot after this deploy, Strapi's schema sync adds the six columns and
then `bootstrap` fills them from `backend/src/utils/dealer-coordinates.seed.json`
(**175 entries**, regenerated for this cutover). It is flag-guarded in the core
store, so it runs once per database, and it only ever fills NULLs.

The 180 production documentIds were checked against the seed on 2026-08-20: all
175 seed keys exist there, nothing missing, nothing extra. So the expected log
line is:

```bash
ssh ploi@170.64.175.224 'pm2 logs cms-escapethenoise-tempcaraveadev --lines 200 --nostream' \
  | grep 'dealer coordinates'
# expect: [bootstrap] dealer coordinates: 175 placed / 0 already set / 0 no matching dealer
```

A `warn` instead of `info` means fewer than 175 landed. Do not shrug it off: the
failure is otherwise silent, because every unpinned dealer quietly falls back to
its postcode centroid and several suburbs stack on one pin. Confirm with:

```bash
ssh ploi@170.64.175.224 'sqlite3 -readonly \
  /home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
  "select count(*) from dealer_submissions where latitude is not null;"'   # expect 175
```

**Five live dealers will still have no pin, on purpose.** Their addresses are
corrupt or fictional and no geocoder will resolve them until a human fixes the
address: All Brand Caravan Services (`SANDGATE DC;QLD`), Capricorn Caravan Centre
(`Park Avenue North Rockhampton`, two suburbs mashed together), Main Event RV
Townsville (`Twonsville`), Cannington RV Centre (`Becknham`), and the
`Caravea DEv` lorem-ipsum test record, which should be deleted rather than fixed.

## 5. Top up any dealer who submitted between now and the deploy

The seed is a snapshot. A dealer who submits on the live site *before* this
release goes out gets no pin, because the self-pin field is not deployed yet, and
they are not in the seed either. After the release, new submissions carry their
own pin and no top-up is needed. So this step is a one-off, sized by however long
the merge takes.

```bash
ssh ploi@170.64.175.224 'sqlite3 -readonly \
  /home/ploi/cms.nobettertime.com.au/backend/.tmp/data.db \
  "select count(*) from dealer_submissions where latitude is null;"'
```

Expect 5 (the permanent misses above). Anything higher is a new arrival. Fill the
gap with the existing backstop script, which finds rows with no latitude and
geocodes their street address:

```bash
# In the CMS admin: Settings > API Tokens > create a Full access token, short
# lifespan. It needs geocode.resolveAddress and dealer-submission.update.
cd backend
STRAPI_URL=https://cms.nobettertime.com.au STRAPI_TOKEN=<token> \
  npm run seed:dealer-geo -- --dry     # read the plan first
STRAPI_URL=https://cms.nobettertime.com.au STRAPI_TOKEN=<token> \
  npm run seed:dealer-geo
# then DELETE the token in the admin
```

Never pass `--overwrite`. It clobbers dealer-placed and staff-corrected pins, and
provenance is a private field so the script cannot tell a guess from a
correction. The default run only fills gaps, which is what you want.

Nominatim is rate-limited to 1 request/second process-wide, so a large gap takes
a while. That limit is policy, not tuning. Do not raise it, and do not swap in
Mapbox geocoding: its standard Geocoding API forbids storing the results.

## 6. Mapbox token, then a real rebuild

After replacing the placeholder token in `frontend/.env`, a plain redeploy is not
enough. `NEXT_PUBLIC_*` values are inlined at build time and the webpack cache
holds the old value already inlined into cached modules. The tell-tale is a
suspiciously fast "Compiled successfully in ~3s".

```bash
ssh ploi@170.64.175.224
cd /home/ploi/nobettertime.com.au
rm -rf frontend/.next          # the whole directory, not just .next/cache
npm run build --workspace=frontend
export PORT=3004
pm2 restart escapethenoise-tempcaraveadev --update-env
```

## 7. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://nobettertime.com.au/find-dealer   # 200
curl -s https://cms.nobettertime.com.au/api/recaptcha-config                       # enabled:true
```

Then in a browser on `/find-dealer`:

- The dealer count in the subtitle matches the state tiles, and the tiles show
  only NSW, VIC and QLD.
- Map pins are spread across suburbs rather than stacked on postcode centres.
  23 of the 175 seeded coordinates are genuine duplicates (several MDC locations,
  Vision RV and Goldstream RV each submitted twice), so a few stacked pins are
  expected and are a content problem, not a geocoding one.
- A postcode search moves the camera, and "Near me" works.
- Open a dealer: the modal shows address, hours, services and brands. The
  enquiry form shows for every dealer since ETN-010.

Whatever Connect holds is what the page shows. If production points at a Connect
instance whose import has not run, the page is honest but empty. That is a data
question for the Connect team, not a deploy failure.

## Rollback

Restore the database backup from step 1. Reverting the merge alone loses the
coordinates, because the columns go with the schema.
