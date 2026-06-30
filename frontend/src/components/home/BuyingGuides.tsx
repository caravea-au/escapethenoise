import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";

const GUIDES = [
  {
    image: "/photos/edu-feat.webp",
    tag: "First-time Buyers",
    title: "Caravanning for beginners: what you need to know",
    body: "A plain-English run-through of van types, towing basics, running costs and what dealer accreditation means for your first purchase.",
    read: "10 min read",
  },
  {
    image: "/photos/road-calling.webp",
    tag: "Towing & Safety",
    title: "Caravan safety: loading, towing, hitching and more",
    body: "A practical pre-trip safety run-through — towing capacity, loading, tyres, brakes, hitching, gas and fire.",
    read: "5 min read",
  },
  {
    image: "/photos/d3.webp",
    tag: "First-time Buyers",
    title: "Understanding caravan dimensions",
    body: "Body length, overall length and width explained — and why the numbers matter for storage, ferries and park sites.",
    read: "4 min read",
  },
];

// Latest buying guides — three article cards (design.md §6 card pattern).
export function BuyingGuides() {
  return (
    <Container className="pt-[88px] pb-[116px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Learn before you buy</Eyebrow>
          <Heading as="h2" className="mt-2 text-[26px] text-green md:text-[27px] lg:text-[36px]">
            Latest Buying Guides
          </Heading>
        </div>
        <Button href="#" variant="outline" className="rounded-[9px] px-[18px] py-[11px] text-sm">
          View Buying Guides →
        </Button>
      </div>

      <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[22px]">
        {GUIDES.map((g) => (
          <Link
            key={g.title}
            href="#"
            className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_16px_44px_-16px_rgba(22,39,28,.11)] transition-transform duration-[400ms] hover:-translate-y-1.5"
          >
            <div className="relative h-[190px] overflow-hidden">
              <Image src={g.image} alt={g.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-[11px] p-[22px]">
              <span className="self-start rounded-[20px] bg-[#f4e8d4] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.4px] text-rust">
                {g.tag}
              </span>
              <h3 className="font-oswald text-[18.5px] font-bold leading-[1.25] text-green">{g.title}</h3>
              <p className="text-sm leading-[1.55] text-muted">{g.body}</p>
              <div className="mt-auto flex items-center justify-between pt-1.5">
                <span className="text-[12.5px] font-medium text-[#a59a7d]">{g.read}</span>
                <span className="text-[13.5px] font-semibold text-rust">Read article →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}
