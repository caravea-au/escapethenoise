import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
import { OpenDayCTA } from "@/components/home/OpenDayCTA";
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
import { LifestyleBand } from "@/components/home/LifestyleBand";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <OpenDayCTA />
      <JourneySection />
      <BuyingGuides />
      <LifestyleBand />
    </>
  );
}
