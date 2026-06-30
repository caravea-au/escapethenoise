import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
// import { OpenDayCTA } from "@/components/home/OpenDayCTA"; // hidden — Open Day banner
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
import { LifestyleBand } from "@/components/home/LifestyleBand";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      {/* <OpenDayCTA /> hidden during design iteration — Open Day banner */}
      <JourneySection />
      <BuyingGuides />
      <LifestyleBand />
    </>
  );
}
