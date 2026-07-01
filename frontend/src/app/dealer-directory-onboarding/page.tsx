import type { Metadata } from "next";
import { DealerOnboardingForm } from "@/components/DealerOnboardingForm/DealerOnboardingForm";

export const metadata: Metadata = {
  title: "List your dealership",
  description:
    "List your dealership on nobettertime.com.au and get found by the caravan and RV travellers searching for their next escape.",
  robots: { index: false, follow: false },
};

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

// Public reCAPTCHA config (site key only) from Strapi's SMTP Settings.
async function getRecaptchaConfig(): Promise<{
  enabled: boolean;
  siteKey: string | null;
}> {
  try {
    const res = await fetch(`${STRAPI_URL}/api/recaptcha-config`, {
      // Keys change rarely; revalidate periodically rather than per request.
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.json()) as { enabled: boolean; siteKey: string | null };
  } catch {
    // Fail open on the fetch, not on protection: if we can't read the key the
    // form still works, and the server-side check still guards the submission.
    return { enabled: false, siteKey: null };
  }
}

export default async function DealerDirectoryOnboardingPage() {
  const { enabled, siteKey } = await getRecaptchaConfig();
  return (
    <DealerOnboardingForm recaptchaEnabled={enabled} recaptchaSiteKey={siteKey} />
  );
}
