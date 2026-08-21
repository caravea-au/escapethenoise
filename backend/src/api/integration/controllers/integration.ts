/**
 * On-demand dealer sync.
 *
 * The cron task (config/cron-tasks.ts) is the normal path; this is the lever for
 * "refresh now" after someone has fixed data on Connect and does not want to
 * wait out the interval.
 *
 * Deliberately NOT `factories.createCoreController` — there is no content type
 * in this folder, which is the point. See routes/integration.ts for why the
 * folder has to stay content-type-less.
 */

import type { Context } from 'koa';
import { runDealerSync } from '../services/dealer-sync';

export default {
  async syncDealers(ctx: Context) {
    const summary = await runDealerSync(strapi);

    // 200 either way, with the outcome in the body. The caller is a human or a
    // deploy script asking "what happened", and a 500 here would say nothing
    // about WHICH rail stopped the sweep — `status` and `errors` do.
    ctx.body = { data: summary };
  },
};
