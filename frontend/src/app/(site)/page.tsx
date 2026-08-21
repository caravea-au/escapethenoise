import { Hero } from "@/components/home/Hero";
// import { TrustBar } from "@/components/home/TrustBar"; // hidden: see the render below
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
      {/* <TrustBar data={home?.trustBar} /> is hidden at the client's request (2026-08-21,
          following up their 18 Aug note): its claims cannot be substantiated while the
          directory serves NSW/VIC/QLD only. "403+ Accredited Dealers", "8 States &
          Territories", the nine state-association logos and "The official directory of"
          CIAA all overstate current coverage. Restore once the stats and the association
          partnerships are signed off (ETN-006 D1/D3). */}
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
