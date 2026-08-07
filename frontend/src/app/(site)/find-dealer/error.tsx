"use client";

import { useEffect } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

// This route's error boundary — the app has no error.tsx above (site)/, so
// this is the first line of defence if something throws during render
// (rather than the CMS-outage path in page.tsx, which is caught explicitly).
export default function FindDealerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <Heading as="h1" className="text-[26px] text-green md:text-[32px]">
        Something went wrong loading the dealer directory
      </Heading>
      <Text variant="lead" className="mt-2.5 max-w-md text-muted">
        Please try again — if this keeps happening, check back shortly.
      </Text>
      <Button onClick={() => reset()} className="mt-8">
        Try again
      </Button>
    </div>
  );
}
