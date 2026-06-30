import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "You're on the map",
  description: "Thanks — your dealership details are in.",
};

export default function DealerOnboardingThankYouPage() {
  return (
    <Hero
      eyebrow="Thank you"
      title={
        <>
          You&apos;re on
          <br />
          the <span className="text-rust">map</span>
        </>
      }
      subtitle={
        <>
          Thanks — your dealership details are in. We&apos;ll review them and have your listing
          live on nobettertime.com.au shortly. Enquiries will start coming straight to you.
        </>
      }
    >
      <div className="mt-9 flex justify-center">
        <Button href="/" variant="glass" className="rounded-chip px-7 py-3">
          Back to home
        </Button>
      </div>
    </Hero>
  );
}
