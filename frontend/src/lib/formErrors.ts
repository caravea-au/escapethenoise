// Shared Strapi error handling for dealer-facing forms (onboarding + directory
// enquiry). Keeping this in one place means both forms surface the exact same
// wording for the exact same failure — never match on the message text, the
// backend's `error.details.code` values are the contract.

export const GENERIC_SUBMIT_ERROR =
  "Something went wrong sending your details. Please try again in a moment.";

// Maps the backend's stable `error.details.code` values to what the dealer reads.
// Never match on the message text — these codes are the contract.
export function messageForCode(code: string, supportEmail: string | null): string {
  const emailSentence = supportEmail
    ? ` If that's not possible, email us at ${supportEmail} and we'll list you manually.`
    : "";
  switch (code) {
    case "recaptcha-browser-blocked":
      return `Your browser or network is blocking our spam check, so we can't confirm you're human. Try turning off your ad blocker, or use a different browser or network.${emailSentence}`;
    case "recaptcha-low-score":
      // Unlike browser-blocked, a low v3 score is scored fresh on every attempt,
      // so a second go genuinely often passes. Lead with "try again" — and your
      // details are still on screen, so retrying costs nothing.
      return supportEmail
        ? `Our spam check wasn't sure about this one. Your details are still here, so please press the button again. If it keeps happening, email us at ${supportEmail} and we'll list you manually.`
        : "Our spam check wasn't sure about this one. Your details are still here, so please press the button again.";
    case "recaptcha-missing-token":
    case "recaptcha-action-mismatch":
      return "Our spam check didn't finish loading. Please refresh the page and try again.";
    case "recaptcha-unavailable":
      return "We couldn't reach our spam checker just now. Please try again in a moment.";
    case "rate-limited":
      return "You've sent a few enquiries in a short space of time. Please wait a bit before trying again.";
    case "dealer-not-found":
      return "This dealer listing couldn't be found. Please refresh the page and try again.";
    // Since ETN-010 the backend no longer refuses an unapproved dealer, so
    // this code is only reachable from a page cached against an older backend.
    // Kept because it costs nothing and the alternative is the generic error.
    case "dealer-not-approved":
      return "This dealer isn't taking enquiries through the directory yet.";
    case "connect-unavailable":
      return "We couldn't confirm this dealer's details just now. Please try again in a moment.";
    default:
      return GENERIC_SUBMIT_ERROR;
  }
}

// Strapi errors come back as { data: null, error: { status, message, details } }.
// Pull out the code and message rather than throwing the body away.
export async function readStrapiError(
  res: Response,
): Promise<{ status: number; code: string; message: string }> {
  let code = "";
  let message = "";
  try {
    const parsed = (await res.json()) as {
      error?: { message?: string; details?: { code?: string } };
    };
    code = parsed?.error?.details?.code ?? "";
    message = parsed?.error?.message ?? "";
  } catch {
    // Non-JSON body (an nginx error page, say) — status is all we get.
  }
  return { status: res.status, code, message };
}
