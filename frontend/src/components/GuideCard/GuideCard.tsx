import Image from "next/image";
import Link from "next/link";
import type { BuyingGuide } from "@/lib/strapi";
import { strapiMedia } from "@/lib/strapi";
import { CategoryBadge } from "@/components/CategoryBadge/CategoryBadge";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

// Article card for the Buying Guides grid. Whole card links to the guide.
export function GuideCard({ guide }: { guide: BuyingGuide }) {
  const img = strapiMedia(guide.cardImage?.url);
  return (
    <Link
      href={`/buying-guides/${guide.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-[0_16px_44px_-16px_rgba(22,39,28,.11)] transition-transform duration-200 ease-[cubic-bezier(.2,.7,.2,1)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative h-[190px] w-full overflow-hidden">
        {img && (
          <Image
            src={img}
            alt={guide.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-[11px] p-[22px]">
        {guide.category && <CategoryBadge tone="card">{guide.category}</CategoryBadge>}
        <Heading as="h3" size="card" className="text-green">
          {guide.title}
        </Heading>
        {guide.excerpt && (
          <Text variant="body" className="line-clamp-3 text-tag">
            {guide.excerpt}
          </Text>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          {guide.readTime && <Text variant="meta">{guide.readTime}</Text>}
          <span
            aria-hidden
            className="text-rust transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
