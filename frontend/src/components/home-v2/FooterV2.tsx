import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

const COLUMNS = [
  { title: "Find a Dealer", links: ["Search dealers", "Near me", "Special offers", "Open now"] },
  { title: "Resources", links: ["Buying guides", "Towing guide", "Events & shows", "Safety advice"] },
  { title: "About CIAA", links: ["About us", "Accreditation", "For dealers", "Contact"] },
];

// Bespoke editorial footer for /v2 — oversized wordmark, serif-italic accent line,
// restrained columns, hairline rules.
export function FooterV2() {
  return (
    <footer className="bg-green-dark text-sand">
      <Container className="py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8 border-b border-white/12 pb-12">
          <div>
            <div className="font-oswald text-[44px] font-bold uppercase leading-[0.9] tracking-[-1px] text-white sm:text-[62px] lg:text-[84px]">
              Find a dealer
            </div>
            <p className="mt-5 max-w-[440px] text-[16px] leading-[1.65] text-sand/85">
              The official dealer directory of the Caravan Industry Association of Australia —{" "}
              <span className="font-serif text-[17px] italic text-gold">
                403+ accredited dealers, every state and territory.
              </span>
            </p>
          </div>
          <Button href="#" className="px-7 py-4 text-base">
            Find your nearest dealer →
          </Button>
        </div>

        <div className="grid gap-10 pt-12 sm:grid-cols-2 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-4 text-[12px] font-semibold uppercase tracking-[2px] text-gold">
                {col.title}
              </div>
              <div className="flex flex-col gap-2.5 text-[14px] text-sand/80">
                {col.links.map((l) => (
                  <Link key={l} href="#" className="w-fit transition-colors hover:text-white">
                    {l}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-white/12 pt-6 text-[12px] text-sand/55">
          <span>© 2026 Caravan Industry Association of Australia</span>
          <span className="flex gap-5">
            <Link href="#" className="hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-white">Terms</Link>
            <span>escapethenoise.com.au · 1300 555 000</span>
          </span>
        </div>
      </Container>
    </footer>
  );
}
