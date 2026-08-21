/**
 * One-time backfill of the 175 dealer map coordinates onto dealer-submission.
 *
 * These coordinates used to live in a separate `dealer-geocode` collection.
 * When that collection was folded into dealer-submission, its rows had to come
 * with it — and on the live server they never existed at all, because the
 * collection was merged before it was ever deployed. So the source of truth for
 * this backfill is the committed seed file, not the old table.
 *
 * WHY NOT A STRAPI MIGRATION (backend/database/migrations). Strapi runs user
 * migrations BEFORE the content-type schema sync: `schema.sync()` calls
 * `db.migrations.up()` and only then `syncSchema()`. So inside a migration the
 * new latitude/longitude columns do not exist yet, and an UPDATE against them
 * throws "no such column", rolls back, is never recorded as run, and fails
 * identically on every subsequent boot — a boot loop that needs a code change to
 * escape. Guarding with `hasColumn` and skipping is worse: umzug records the
 * migration as done, so it never runs again and the data is silently lost behind
 * a green boot. Running here in bootstrap sidesteps all of it: bootstrap runs
 * after the sync, so the columns are guaranteed to exist.
 *
 * The same ordering is why this reads the seed file rather than the old table:
 * by the time bootstrap runs, `syncSchema()` has already dropped dealer_geocodes
 * (a tracked table absent from the user schema gets dropped, silently). Reading
 * the file has no such window. It is a faithful substitute — the file was
 * verified identical to the table before the move: 142 keys, no key differences,
 * no value differences beyond 1e-9, and every row `source: 'imported'`.
 *
 * REGENERATED 2026-08-20, 142 -> 175 entries, ahead of the first deploy to
 * production. The original 142 came from dealer_geocodes; the 33 added here are
 * dealers who arrived after that snapshot and were geocoded locally by
 * scripts/geocode-dealers.mjs. Regenerating rather than appending was verified
 * safe: the new file drops no key and drifts on none of the original 142 (zero
 * coordinate, precision or address differences), so a database that already ran
 * this backfill is unaffected either way.
 *
 * The seed is sized to production deliberately. Every one of the 175 documentIds
 * exists in production's dealer_submissions (checked with a read-only query on
 * the live box), and the 5 live dealers still missing a pin are absent on
 * purpose: their source addresses are corrupt or fictional, so no geocoder will
 * ever resolve them and a human has to fix the address first. Do not pad the
 * file to 180 to make the numbers line up.
 *
 * To regenerate: geocode the gaps locally, then emit
 * `documentId -> [latitude, longitude, precision, matchedAddress]` for every
 * dealer_submissions row that has coordinates, sorted by documentId, and bump
 * EXPECTED to match. Re-check the no-drift property before committing.
 *
 * This is NOT a seed script that runs on every boot (which CLAUDE.md forbids).
 * It is flag-guarded in Strapi's core store, so it runs once per database, and
 * it only ever fills NULLs — a coordinate corrected by staff in the admin is
 * never overwritten.
 */

import type { Core } from '@strapi/strapi';

import { cleanAddress } from './dealer-pin';
import seed from './dealer-coordinates.seed.json';

const SUBMISSION_UID = 'api::dealer-submission.dealer-submission';

// Namespaced like Strapi's own one-shot markers (see the
// 'unidirectional-join-table-repair-ran' flag in its bootstrap).
const FLAG = { type: 'core', key: 'dealer-coordinates-backfilled' } as const;

// What we expect to place. Used only to decide how loudly to complain — the
// backfill is never fatal.
const EXPECTED = 175;

/** `documentId -> [latitude, longitude, precision, matchedAddress]`. */
type SeedEntry = [number, number, string, string];
const SEED = seed as unknown as Record<string, SeedEntry>;

export async function backfillDealerCoordinates(
  strapi: Core.Strapi,
): Promise<void> {
  try {
    if (await strapi.store.get(FLAG)) return;

    let placed = 0;
    let alreadySet = 0;
    let noSuchDealer = 0;

    for (const [documentId, entry] of Object.entries(SEED)) {
      const [latitude, longitude, precision, matchedAddress] = entry ?? [];
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const row = await strapi.db.query(SUBMISSION_UID).findOne({
        select: ['id', 'latitude'],
        where: { documentId },
      });

      if (!row) {
        noSuchDealer += 1;
        continue;
      }
      // Only ever fill a gap. A staff correction in the admin outranks the seed.
      if (row.latitude !== null && row.latitude !== undefined) {
        alreadySet += 1;
        continue;
      }

      await strapi.db.query(SUBMISSION_UID).update({
        where: { id: row.id },
        data: {
          latitude,
          longitude,
          precision: precision === 'street' ? 'street' : 'approx',
          // Provenance only the backend may assert. A form submission can only
          // ever be 'geocoded' or 'adjusted'.
          geocodeSource: 'imported',
          // Through the same sanitiser the form path uses, rather than stored
          // raw. The seed file is committed and currently clean (no formula
          // leaders, no angle brackets, longest entry 119 chars), so this
          // changes nothing today — it just means the only way an address
          // reaches this column is via cleanAddress, whoever edits the file.
          matchedAddress: cleanAddress(matchedAddress),
        },
      });
      placed += 1;
    }

    await strapi.store.set({ ...FLAG, value: true });

    const summary = `${placed} placed · ${alreadySet} already set · ${noSuchDealer} no matching dealer`;

    // Loud on a bad match rate. If live's documentIds ever diverged from the
    // seed keys this would place nothing, and the failure would otherwise be
    // SILENT: every dealer quietly falls back to a postcode centroid on
    // /find-dealer, which is the exact defect this feature exists to fix.
    if (placed + alreadySet < EXPECTED) {
      strapi.log.warn(
        `[bootstrap] dealer coordinates: ${summary} — expected ${EXPECTED}. ` +
          'Dealers without coordinates fall back to their postcode centroid, ' +
          'so several suburbs will stack on one pin. Check that the seed ' +
          "documentIds match this database's dealer-submission rows.",
      );
    } else {
      strapi.log.info(`[bootstrap] dealer coordinates: ${summary}`);
    }
  } catch (error) {
    // Never block boot. A missing pin is a visible regression; a CMS that will
    // not start takes the whole site's content down with it.
    strapi.log.error(
      `[bootstrap] dealer coordinate backfill failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
