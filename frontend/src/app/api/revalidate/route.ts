// On-demand revalidation, called by Strapi.
//
// One caller and one purpose today: a staff member publishes or unpublishes a
// dealer, and /find-dealer has to reflect it on the next page load rather than
// after the 60 second data-cache window. That window is fine for the dealer sync
// (a Connect edit taking a few minutes to appear is expected) but not for a human
// action — after ETN-013's D2 ruling the publish toggle is the ONLY human-facing
// action left on a dealer, and staff flip one then immediately reload the page.
//
// Two properties of Next's data cache make the ping worth having rather than just
// shortening the window: it is stale-while-revalidate, so the first visitor after
// expiry still sees the OLD data and only triggers the refresh for whoever comes
// next; and it does not move at all without traffic.
//
// See backend/src/utils/revalidate-frontend.ts for the caller and
// backend/src/api/dealer/content-types/dealer/lifecycles.ts for the trigger.

import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

// Tags this route is willing to invalidate. An allow-list rather than "whatever
// the body says", because a caller who could name arbitrary tags could flush the
// entire data cache on demand and turn every page into an origin request. Adding
// a tag here is a deliberate act.
const ALLOWED_TAGS = new Set(["dealers"]);

// Read at request time, not module scope: an unset secret must make this route
// refuse everything (which it does, below), not break the build.
function expectedSecret(): string | undefined {
  return process.env.REVALIDATE_SECRET;
}

type Body = { tags?: unknown };

export async function POST(request: NextRequest) {
  const secret = expectedSecret();
  const provided = request.headers.get("x-revalidate-secret");

  // Unset secret refuses everything. That is the correct closed default: the only
  // cost of this route being dormant is that a publish takes up to 60 seconds to
  // show, whereas an unauthenticated cache-flush endpoint is a denial-of-service
  // lever on a public site.
  if (!secret || provided !== secret) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // No or invalid JSON — nothing to invalidate, but the caller authenticated,
    // so this is a no-op rather than an error.
  }

  const requested = Array.isArray(body.tags) ? body.tags : [];
  const revalidated: string[] = [];

  for (const tag of requested) {
    if (typeof tag === "string" && ALLOWED_TAGS.has(tag)) {
      // Next 16 made the second argument mandatory: it says how stale an entry
      // may be and still survive. `{ expire: 0 }` is the full purge this route
      // exists for — a named profile ("hours", "days") would keep serving the
      // old dealer list for that profile's window, which is precisely the wait
      // the ping is here to remove.
      revalidateTag(tag, { expire: 0 });
      revalidated.push(tag);
    }
  }

  return NextResponse.json({ revalidated: true, tags: revalidated });
}
