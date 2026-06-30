import { Hero } from "@/components/home/Hero";
// import { TrustBar } from "@/components/home/TrustBar"; // hidden during design iteration — National Standard section
// import { OpenDayCTA } from "@/components/home/OpenDayCTA"; // hidden — Open Day banner
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
// import { LifestyleBand } from "@/components/home/LifestyleBand"; // hidden during design iteration — Open Road is Calling section

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* <TrustBar /> hidden during design iteration — National Standard section */}
      {/* <OpenDayCTA /> hidden during design iteration — Open Day banner */}
      <JourneySection />
      <BuyingGuides />
      {/* <LifestyleBand /> hidden during design iteration — Open Road is Calling section */}
    </>
  );
}
