import type { Metadata } from "next";
import { HeroV2 } from "@/components/home-v2/HeroV2";
import { Manifesto } from "@/components/home-v2/Manifesto";
import { PartnerMarquee } from "@/components/home-v2/PartnerMarquee";
import { Process } from "@/components/home-v2/Process";
import { GuidesV2 } from "@/components/home-v2/GuidesV2";
import { CtaBand } from "@/components/home-v2/CtaBand";

export const metadata: Metadata = {
  title: "Find a Dealer — v2 (editorial)",
  description: "Editorial premium homepage direction for the CIAA dealer directory.",
};

// v2 — editorial/premium homepage direction (Fathom-inspired language, CIAA content).
// Lives at /v2 so the current homepage at / stays intact for comparison.
export default function HomeV2() {
  return (
    <>
      <HeroV2 />
      <Manifesto />
      <PartnerMarquee />
      <Process />
      <GuidesV2 />
      <CtaBand />
    </>
  );
}
