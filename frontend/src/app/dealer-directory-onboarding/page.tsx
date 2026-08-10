import type { Metadata } from "next";
import { DealerOnboardingForm } from "@/components/DealerOnboardingForm/DealerOnboardingForm";
import { getRecaptchaConfig } from "@/lib/recaptcha";

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

export default async function DealerDirectoryOnboardingPage() {
  const { enabled, siteKey, supportEmail, configError } = await getRecaptchaConfig();

  if (configError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-[18px] text-center sm:px-7">
        <h1 className="m-0 mb-3.5 font-oswald text-[28px] font-bold leading-[1.1] text-green md:text-[34px]">
          We can&apos;t load the form right now
        </h1>
        <p className="m-0 text-[16.5px] text-muted">
          Something on our end isn&apos;t responding, so the form can&apos;t be
          submitted at the moment. Please refresh the page, or try again shortly.
        </p>
      </main>
    );
  }

  return (
    <DealerOnboardingForm
      recaptchaEnabled={enabled}
      recaptchaSiteKey={siteKey}
      supportEmail={supportEmail}
    />
  );
}
