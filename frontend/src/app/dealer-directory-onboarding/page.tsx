import type { Metadata } from "next";
import { DealerOnboardingForm } from "@/components/DealerOnboardingForm/DealerOnboardingForm";

export const metadata: Metadata = {
  title: "List your dealership",
  description:
    "List your dealership on nobettertime.com.au and get found by the caravan and RV travellers searching for their next escape.",
};

export default function DealerDirectoryOnboardingPage() {
  return <DealerOnboardingForm />;
}
