import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { Hero } from "@/components/home/Hero";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "You're on the map",
  description: "Thanks — your dealership details are in.",
  robots: { index: false, follow: false },
};

export default async function DealerOnboardingThankYouPage({
  searchParams,
}: {
  // Next 16 hands searchParams over as a Promise.
  searchParams: Promise<{ media?: string }>;
}) {
  // `?media=N` means N logo/photo uploads failed. The submission itself is saved
  // either way, so this is an honest heads-up, not an error.
  const { media } = await searchParams;
  const failedMedia = Number(media) > 0 ? Number(media) : 0;

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
          {failedMedia > 0 && (
            <p className="mx-auto mt-7 max-w-[52ch] rounded-input bg-white/10 px-5 py-4 text-[15px] text-white/90">
              One thing: {failedMedia === 1 ? "one of your images" : `${failedMedia} of your images`}{" "}
              didn&apos;t upload. Everything else is saved, and we&apos;ll email you to get{" "}
              {failedMedia === 1 ? "it" : "them"}.
            </p>
          )}
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
