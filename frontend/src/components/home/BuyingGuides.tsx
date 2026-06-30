import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";
import { getBuyingGuides, strapiMedia } from "@/lib/strapi";

// Latest buying guides — first three guides from Strapi (design.md §6 card pattern).
export async function BuyingGuides() {
  const guides = (await getBuyingGuides()).slice(0, 3);
  if (guides.length === 0) return null;

  return (
    <Container className="pt-[88px] pb-[116px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Learn before you buy</Eyebrow>
          <Heading as="h2" className="mt-2 text-[26px] text-green md:text-[27px] lg:text-[36px]">
            Latest Buying Guides
          </Heading>
        </div>
        <Button href="/buying-guides" variant="outline" className="rounded-[9px] px-[18px] py-[11px] text-sm">
          View Buying Guides →
        </Button>
      </div>

      <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[22px]">
        {guides.map((g) => {
          const img = strapiMedia(g.cardImage?.url);
          return (
            <Link
              key={g.slug}
              href={`/buying-guides/${g.slug}`}
              className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_16px_44px_-16px_rgba(22,39,28,.11)] transition-transform duration-[400ms] hover:-translate-y-1.5"
            >
              <div className="relative h-[190px] overflow-hidden">
                {img && (
                  <Image src={img} alt={g.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-[11px] p-[22px]">
                {g.category && (
                  <span className="self-start rounded-[20px] bg-[#f4e8d4] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.4px] text-rust">
                    {g.category}
                  </span>
                )}
                <h3 className="font-oswald text-[18.5px] font-bold leading-[1.25] text-green">{g.title}</h3>
                {g.excerpt && <p className="text-sm leading-[1.55] text-muted">{g.excerpt}</p>}
                <div className="mt-auto flex items-center justify-between pt-1.5">
                  {g.readTime && <span className="text-[12.5px] font-medium text-[#a59a7d]">{g.readTime}</span>}
                  <span className="text-[13.5px] font-semibold text-rust">Read article →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
