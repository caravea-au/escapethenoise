import type { Metadata } from "next";
import { NavbarV2 } from "@/components/home-v2/NavbarV2";
import { FooterV2 } from "@/components/home-v2/FooterV2";
import { HeroV2 } from "@/components/home-v2/HeroV2";
import { Manifesto } from "@/components/home-v2/Manifesto";
import { PartnerMarquee } from "@/components/home-v2/PartnerMarquee";
import { Process } from "@/components/home-v2/Process";
import { ImageBand } from "@/components/home-v2/ImageBand";
import { GuidesV2 } from "@/components/home-v2/GuidesV2";
import { CtaBand } from "@/components/home-v2/CtaBand";

export const metadata: Metadata = {
  title: "Find a Dealer — v2 (editorial)",
  description: "Editorial premium homepage direction for the CIAA dealer directory.",
};

// v2 — editorial/premium homepage direction (Fathom-inspired language, CIAA content).
// Lives at /v2 with its own bespoke chrome so the current homepage at / stays intact.
export default function HomeV2() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavbarV2 />
      <main className="flex-1">
        <HeroV2 />
        <Manifesto />
        <PartnerMarquee />
        <Process />
        <ImageBand />
        <GuidesV2 />
        <CtaBand />
      </main>
      <FooterV2 />
    </div>
  );
}
