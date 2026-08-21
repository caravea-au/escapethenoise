/**
 * Resolve a dealer an enquiry is being filed against, from the local cache.
 *
 * REPLACES `connect-lookup.ts`, which resolved the same thing by SCANNING
 * Connect's paginated list — up to 20 sequential HTTP requests on every single
 * enquiry submission, protected only by a per-IP rate limit of 5 per 15 minutes,
 * because the list endpoint stopped emitting the `submission_id` its own by-id
 * endpoint accepts. That is now one indexed local read.
 *
 * TWO things are enforced here, and both are gates rather than conveniences:
 *
 *  1. The dealer must EXIST. An enquiry is a lead with a consumer's contact
 *     details attached, so an unknown id must stop the write rather than store a
 *     lead against a dealership we cannot confirm is real.
 *  2. The dealer must be PUBLISHED. This is ETN-013's D3 ruling: a dealer staff
 *     have hidden leaves the cards, the count, the tiles and the map, and cannot
 *     receive an enquiry either. Without this the form is merely hidden — a held
 *     link or a curl still files leads against them.
 *
 * `sourceStatus` is deliberately NOT part of the gate. A dealer who has vanished
 * from Connect's feed is flagged `missing` but stays listed on the page, so they
 * must stay reachable: refusing their enquiries would leave a live card whose
 * form silently fails.
 *
 * Approval is deliberately NOT checked (ETN-010): approved and unapproved
 * dealers alike can be sent an enquiry. Visibility is the publish toggle.
 *
 * `name` is ALWAYS taken from the resolved row, never from the request body: it
 * is denormalised onto the stored enquiry, so a caller who could set it could
 * write whatever they liked into an admin's view of who a lead was for.
 */

const DEALER_UID = 'api::dealer.dealer';

/**
 * Flat rather than a discriminated union on `ok` — this backend compiles with
 * `strict: false` (backend/tsconfig.json), and without strictNullChecks
 * TypeScript will not narrow a boolean-literal discriminant, so
 * `if (result.ok) result.name` fails to compile on a union. Same reason as
 * `ConnectPushGateResult` in connect-registration.ts.
 */
export type CachedDealerLookup = {
  ok: boolean;
  /** Set only when `ok` — the dealership name as the cache holds it. */
  name?: string;
  code?: 'dealer-not-found';
};

/**
 * Looks up a dealer by their Connect `reference`, which is what /find-dealer
 * puts on every card and what the enquiry POST sends back.
 *
 * A hidden dealer answers `dealer-not-found`, the same as an id that was never
 * real. That is deliberate: distinguishing them would tell an enquirer that a
 * dealership exists but has been deliberately delisted, which is not ours to
 * disclose and is not information they can act on.
 *
 * `strapi.db.query` rather than the document service, so the publication state
 * is an explicit `publishedAt` filter on a raw row read — the same gate, written
 * the same way, as the public listing in api/dealer/controllers/dealer.ts. Note
 * a draftAndPublish collection keeps draft and published rows side by side in
 * one table, so omitting that filter would resolve hidden dealers happily.
 */
export async function fetchCachedDealer(connectRef: string): Promise<CachedDealerLookup> {
  if (!connectRef) return { ok: false, code: 'dealer-not-found' };

  const row = (await strapi.db.query(DEALER_UID).findOne({
    where: {
      connectRef,
      publishedAt: { $notNull: true },
    },
    select: ['dealershipName'],
  })) as { dealershipName?: string } | null;

  if (!row?.dealershipName) {
    return { ok: false, code: 'dealer-not-found' };
  }

  return { ok: true, name: row.dealershipName };
}
