import Image from "next/image";
import type { BuyingGuide } from "@/lib/strapi";
import { strapiMedia } from "@/lib/strapi";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

// Large two-column promoted guide at the top of the listing.
export function FeaturedGuideCard({ guide }: { guide: BuyingGuide }) {
  const img = strapiMedia(guide.cardImage?.url);
  return (
    <div className="mb-10 grid grid-cols-1 overflow-hidden rounded-card border border-line bg-white shadow-[0_22px_54px_-24px_rgba(22,39,28,.18)] md:grid-cols-2">
      <div className="relative min-h-[220px] md:min-h-[300px]">
        {img && (
          <Image
            src={img}
            alt={guide.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        )}
      </div>
      <div className="flex flex-col justify-center p-7 md:p-12">
        <Text variant="eyebrow" className="text-rust">
          Featured guide
        </Text>
        <Heading as="h2" size="feature" className="mt-3 text-green">
          {guide.title}
        </Heading>
        {guide.excerpt && (
          <Text variant="body" className="mt-3.5 text-tag">
            {guide.excerpt}
          </Text>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button href={`/buying-guides/${guide.slug}`} variant="primary">
            Read the guide →
          </Button>
          {guide.readTime && (
            <Text variant="meta" className="font-medium">
              {guide.readTime}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}
