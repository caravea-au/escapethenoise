import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/CategoryBadge/CategoryBadge";
import { ArticleBody } from "@/components/ArticleBody/ArticleBody";
import {
  getBuyingGuideBySlug,
  getBuyingGuideSlugs,
  strapiMedia,
} from "@/lib/strapi";

export async function generateStaticParams() {
  const slugs = await getBuyingGuideSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getBuyingGuideBySlug(slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.excerpt ?? undefined };
}

export default async function BuyingGuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getBuyingGuideBySlug(slug);
  if (!guide) notFound();

  const hero = strapiMedia(guide.heroImage?.url);

  return (
    <article>
      {/* Hero */}
      <section className="relative isolate bg-green-dark">
        {hero && (
          <Image
            src={hero}
            alt={guide.title}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-green-dark)_55%,transparent)_0%,color-mix(in_srgb,var(--color-green-dark)_70%,transparent)_55%,color-mix(in_srgb,var(--color-green-dark)_94%,transparent)_100%)]" />
        <Container width="article" className="relative pt-10 pb-[46px]">
          <Link
            href="/buying-guides"
            className="inline-flex items-center gap-[7px] text-[13.5px] font-bold text-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            ← Back to Buying Guides
          </Link>
          <div className="mt-4">
            {guide.category && <CategoryBadge tone="hero">{guide.category}</CategoryBadge>}
          </div>
          <Heading as="h1" size="page" className="mt-[18px] text-balance text-white">
            {guide.title}
          </Heading>
          <div className="mt-4 flex flex-wrap gap-[18px] text-[13.5px] text-sand">
            {guide.author && (
              <span className="inline-flex items-center gap-[7px]">
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                {guide.author}
              </span>
            )}
            {guide.readTime && (
              <span className="inline-flex items-center gap-[7px]">
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {guide.readTime}
              </span>
            )}
          </div>
        </Container>
      </section>

      {/* Body */}
      <Container width="article" className="pt-12 pb-16">
        <ArticleBody blocks={guide.content} />

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-7">
          <Link
            href="/buying-guides"
            className="inline-flex items-center gap-[7px] text-sm font-semibold text-rust hover:text-rust-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust"
          >
            ← All Buying Guides
          </Link>
          <Button href="/" variant="tertiary">
            Find your nearest dealer →
          </Button>
        </div>
      </Container>
    </article>
  );
}
