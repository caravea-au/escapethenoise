import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { Hero } from "@/components/home/Hero";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "You're on the map",
  description: "Thanks — your dealership details are in.",
};

export default function DealerOnboardingThankYouPage() {
  // Body is `flex min-h-svh flex-col`; the sticky Navbar and the Footer take
  // their natural height, and the Hero (fullHeight → flex-1) fills the rest —
  // i.e. 100svh minus the header and footer heights, with no scroll.
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero
          fullHeight
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
      </main>
      <Footer />
    </>
  );
}
