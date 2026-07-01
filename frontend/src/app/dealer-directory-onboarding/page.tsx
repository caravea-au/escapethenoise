import type { Metadata } from "next";
import { DealerOnboardingForm } from "@/components/DealerOnboardingForm/DealerOnboardingForm";

const DESCRIPTION =
  "List your dealership on nobettertime.com.au and get found by the caravan and RV travellers searching for their next escape.";

export const metadata: Metadata = {
  title: "List your dealership",
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Find a Dealer",
    locale: "en_AU",
    title: "List your dealership | No Better Time To Escape The Noise",
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "No Better Time To Escape The Noise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "List your dealership | No Better Time To Escape The Noise",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
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
