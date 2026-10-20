import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
// import { OpenDayCTA } from "@/components/home/OpenDayCTA"; // hidden — see the render below
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
import { LifestyleBand } from "@/components/home/LifestyleBand";
import { getHomePage } from "@/lib/strapi";

export default async function HomePage() {
  // One fetch for the whole page; each section falls back to hardcoded content
  // when its slice (or any field) is missing.
  const home = await getHomePage();

  return (
    <>
      <Hero data={home?.hero} showSearch />
      {/* Partners strip only. The stats ("403+ Accredited Dealers", "8 States &
          Territories") and "The official directory of" CIAA line stay hidden: they
          overstate coverage while the directory serves NSW/VIC/QLD only (ETN-006 D1/D3). */}
      <TrustBar data={home?.trustBar} partnersOnly />
      {/* <OpenDayCTA data={home?.openDay} /> — hidden: the fallback date (12 July 2026)
          is in the past and Strapi's openDay is still null, so this would publish a
          finished event. Restore once the client supplies a live date + a real
          registration URL for "Register Now". */}
      <JourneySection data={home?.journey} />
      <BuyingGuides header={home?.buyingGuidesHeader} />
      <LifestyleBand data={home?.lifestyle} />
    </>
  );
}
