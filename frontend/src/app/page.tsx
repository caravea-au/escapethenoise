import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
import { OpenDayCTA } from "@/components/home/OpenDayCTA";
import { JourneySection } from "@/components/home/JourneySection";
import { BuyingGuides } from "@/components/home/BuyingGuides";
import { LifestyleBand } from "@/components/home/LifestyleBand";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <OpenDayCTA />
        <JourneySection />
        <BuyingGuides />
        <LifestyleBand />
      </main>
      <Footer />
    </div>
  );
}
