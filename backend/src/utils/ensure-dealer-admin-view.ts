/**
 * Sensible admin defaults for the `dealer` list view.
 *
 * Strapi derives the Content Manager layout from SCHEMA FIELD ORDER, and
 * `connectRef` is the first attribute on this collection because it is the match
 * key. Left alone that gives staff a list of
 * `id | connectRef | connectSubmissionId | dealershipName`, sorted by
 * `connectRef` — four columns of which three are opaque Connect ids
 * (`caraveacomp|Vrpb3uPIK2QxIgYyeHWA`), and the dealership name last. It also
 * makes `connectRef` the record's `mainField`, which is the label Strapi shows
 * for a dealer everywhere else in the panel.
 *
 * That is unusable for the one job this collection exists for: finding a
 * dealership by name and hiding it. So the list becomes name + website, sorted
 * by name.
 *
 * WHY IT IS IN CODE. This configuration lives in the core store — the database,
 * not the repo — so otherwise it is a click-path in "Configure the view" that has
 * to be repeated per environment and silently isn't. Same reasoning as
 * ensure-dealer-visibility-role.ts.
 *
 * WHY IT ONLY EVER RUNS ONCE. It applies only while `mainField` is still the
 * auto-derived `connectRef`. The moment this has run — or a human has configured
 * the view themselves — that is no longer true and this leaves the config alone.
 * Staff customisations must not be reverted on every restart.
 */

import type { Core } from '@strapi/strapi';

const DEALER_UID = 'api::dealer.dealer';

/**
 * The columns. Deliberately short: this list is scanned by a human looking for
 * one dealership, not read as a data table. `website` stands in for "domain" —
 * the stored values are already bare hosts (`www.example.com.au`) because that is
 * what dealers typed on the onboarding form.
 *
 * Add `state` or `sourceStatus` here if the list ever needs narrowing by hand;
 * `sourceStatus` is the flag for a dealer who has vanished from Connect's feed.
 */
const LIST_COLUMNS = ['dealershipName', 'website'];

/** The value Strapi derives on its own, and therefore the only state we are willing to overwrite. */
const AUTO_DERIVED_MAIN_FIELD = 'connectRef';

type ViewConfig = {
  settings?: Record<string, unknown>;
  layouts?: { list?: string[]; edit?: unknown };
  metadatas?: Record<string, unknown>;
};

export async function ensureDealerAdminView(strapi: Core.Strapi): Promise<void> {
  const params = {
    type: 'plugin',
    name: 'content_manager',
    key: `configuration_content_types::${DEALER_UID}`,
  };

  try {
    const config = (await strapi.store.get(params)) as ViewConfig | null;

    // The content-manager plugin writes this row when it syncs configurations for
    // a new content type. If it has not happened yet, do nothing — the next boot
    // will find it. Fabricating a partial config here risks a broken edit view,
    // which is much worse than one boot with the default column order.
    if (!config?.settings) return;

    if (config.settings.mainField !== AUTO_DERIVED_MAIN_FIELD) return;

    await strapi.store.set({
      ...params,
      value: {
        ...config,
        settings: {
          ...config.settings,
          mainField: 'dealershipName',
          defaultSortBy: 'dealershipName',
          defaultSortOrder: 'ASC',
        },
        layouts: {
          ...config.layouts,
          // Only fields that actually exist survive, so a renamed column here can
          // never leave the list view pointing at nothing.
          list: LIST_COLUMNS.filter((field) => field in (config.metadatas ?? {})),
        },
      },
    });

    strapi.log.info(
      `[bootstrap] set the Dealer list view to ${LIST_COLUMNS.join(' + ')}, sorted by name`,
    );
  } catch (error) {
    // Never fail boot over a panel default.
    strapi.log.warn(
      `[bootstrap] could not set the Dealer admin view: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
