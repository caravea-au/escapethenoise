import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

const GUIDES = [
  { n: "01", cat: "First-time buyers", title: "Caravanning for beginners: what you need to know", read: "10 min", img: "/photos/edu-feat.webp" },
  { n: "02", cat: "Towing & safety", title: "Caravan safety: loading, towing, hitching and more", read: "5 min", img: "/photos/road-calling.webp" },
  { n: "03", cat: "First-time buyers", title: "Understanding caravan dimensions", read: "4 min", img: "/photos/d3.webp" },
];

// /03/ — latest guides as editorial rows. On hover a thumbnail fades in and the title
// shifts to the accent — a quiet, premium micro-interaction (CSS-only, no JS needed).
export function GuidesV2() {
  return (
    <section className="bg-cream py-24 md:py-36">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-10">
          <div>
            <Reveal y={12}>
              <span className="text-[12px] font-semibold uppercase tracking-[3px] text-rust">
                / 03 / Learn before you buy
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="mt-8 font-oswald text-[36px] font-bold uppercase leading-[1.02] tracking-[-0.5px] text-green sm:text-[48px] lg:text-[62px]">
                Latest buying guides
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <Link
              href="#"
              className="group inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1.5px] text-rust"
            >
              View all guides
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>

        <div>
          {GUIDES.map((g, i) => (
            <Reveal key={g.n} delay={i * 0.06}>
              <Link
                href="#"
                className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-line py-8 md:gap-12"
              >
                <span className="font-oswald text-[18px] font-bold text-line transition-colors duration-300 group-hover:text-rust">
                  {g.n}
                </span>

                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[2px] text-rust">
                    {g.cat}
                  </span>
                  <h3 className="mt-2 font-oswald text-[22px] font-bold uppercase leading-[1.08] tracking-[-0.3px] text-green transition-all duration-300 group-hover:translate-x-2 group-hover:text-rust sm:text-[30px]">
                    {g.title}
                  </h3>
                </div>

                <div className="flex items-center gap-6">
                  <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-[8px] opacity-0 transition-all duration-300 group-hover:opacity-100 lg:block">
                    <Image src={g.img} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                  <span className="hidden whitespace-nowrap text-[13px] font-medium text-muted sm:block">
                    {g.read} read
                  </span>
                  <span className="font-oswald text-[20px] text-green transition-transform duration-300 group-hover:translate-x-1 group-hover:text-rust">
                    →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
