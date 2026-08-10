const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

// Public reCAPTCHA config (site key + support email) from Strapi's SMTP Settings.
export async function getRecaptchaConfig(): Promise<{
  enabled: boolean;
  siteKey: string | null;
  supportEmail: string | null;
  configError: boolean;
}> {
  try {
    const res = await fetch(`${STRAPI_URL}/api/recaptcha-config`, {
      // Keys change rarely; revalidate periodically rather than per request.
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const cfg = (await res.json()) as {
      enabled: boolean;
      siteKey: string | null;
      supportEmail?: string | null;
    };
    return { ...cfg, supportEmail: cfg.supportEmail ?? null, configError: false };
  } catch {
    // Fail CLOSED. This used to return `enabled: false`, on the assumption the
    // form would still work — it would not. The client would send no token while
    // the backend still demanded one, so EVERY dealer got a generic error until
    // the 300s ISR window rolled over. One Strapi restart during revalidation
    // was a silent, site-wide form outage. Better to say so honestly.
    return { enabled: false, siteKey: null, supportEmail: null, configError: true };
  }
}
