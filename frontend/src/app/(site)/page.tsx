import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
// import { OpenDayCTA } from "@/components/home/OpenDayCTA"; // hidden — Open Day banner
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
// import { LifestyleBand } from "@/components/home/LifestyleBand"; // hidden during design iteration — Open Road is Calling section
import { getHomePage } from "@/lib/strapi";

export default async function HomePage() {
  // One fetch for the whole page; each section falls back to hardcoded content
  // when its slice (or any field) is missing.
  const home = await getHomePage();

  return (
    <>
      <Hero data={home?.hero} />
      <TrustBar data={home?.trustBar} />
      {/* <OpenDayCTA /> hidden during design iteration — Open Day banner */}
      <JourneySection data={home?.journey} />
      <BuyingGuides header={home?.buyingGuidesHeader} />
      {/* <LifestyleBand /> hidden during design iteration — Open Road is Calling section */}
    </>
  );
}
