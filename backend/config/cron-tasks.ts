import type { Core } from '@strapi/strapi';
import { runDealerSync } from '../src/api/integration/services/dealer-sync';

/**
 * Scheduled tasks.
 *
 * The master on/off switch is `server.ts`'s `cron.enabled`
 * (`CONNECT_SYNC_ENABLED`), so staging and production are independent and a box
 * with no Connect credentials simply never schedules this. The check below is a
 * second guard, so the task is a safe no-op even if something calls or schedules
 * it directly. A third guard — `connectSyncEnabled` on the Integration Setting
 * single type — lives inside `runDealerSync` and lets an admin stop the sweep
 * without a deploy.
 */
const isEnabled = (): boolean =>
  (process.env.CONNECT_SYNC_ENABLED || '').toLowerCase() === 'true';

// Every 10 minutes. Cheap by design: the list endpoint returns COMPLETE records,
// so there is no `1 + N` detail fetch and a full sweep is `ceil(N/100)` requests
// — 2 at the current dealer count, roughly 300 requests a day. Connect runs on
// their own Laravel infrastructure, not the rate-limited shared host that forced
// the 20-per-minute pacing rule on the inventory sync, and there is no
// per-record modified cursor to make a delta read cheaper anyway.
const DEFAULT_CRON = '*/10 * * * *';

const cronTasks = {
  connectDealerSync: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      if (!isEnabled()) return;

      // runDealerSync never throws — every rail reports through the summary — so
      // this catch is for the genuinely unexpected only. A throw escaping a cron
      // task takes the whole scheduler down with it.
      try {
        const summary = await runDealerSync(strapi);
        if (summary.status === 'disabled') return;

        const line =
          `[dealer-sync] ${summary.status}: fetched ${summary.fetched}, ` +
          `created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, ` +
          `missing ${summary.markedMissing}, pins ${summary.pins.street}/${summary.pins.approx}/${summary.pins.none}` +
          (summary.errors.length ? ` — ${summary.errors.length} error(s)` : '');

        if (summary.status === 'failed') strapi.log.error(line);
        else strapi.log.info(line);
      } catch (error) {
        strapi.log.error(
          `[dealer-sync] unexpected failure: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    options: process.env.CONNECT_SYNC_CRON || DEFAULT_CRON,
  },
};

export default cronTasks;
