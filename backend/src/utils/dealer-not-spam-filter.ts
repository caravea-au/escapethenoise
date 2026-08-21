/**
 * Shared "not spam" gate for `api::dealer-submission.dealer-submission` rows.
 *
 * `spamSuspect` is `NULL` for the large majority of real dealers (the spam
 * heuristics simply never fired) and `false` for the rest — only `true` means
 * flagged. A plain `{ spamSuspect: false }` filter would silently exclude
 * every NULL row, which in production data is most of the genuine dealers.
 *
 * Used by both the public dealer directory read (dealer-submission
 * controller) and the dealer-enquiry controller, which must apply the exact
 * same gate when resolving a dealer server-side.
 */
export const DEALER_NOT_SPAM_FILTER = {
  $or: [{ spamSuspect: false }, { spamSuspect: null }],
};
