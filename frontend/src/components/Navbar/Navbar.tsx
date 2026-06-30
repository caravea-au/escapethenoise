import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
// import { Button } from "@/components/ui/Button"; // hidden with "Visit a Dealer" CTA

const LINKS = [
  // Hidden during design iteration — dealer-search elements:
  // { label: "Find a Dealer", href: "#" },
  // { label: "Browse by State", href: "#" },
  { label: "Buying Guides", href: "#" },
  { label: "Events", href: "#" },
];

// Tier-2 — global header (design.md §4). Reversed lockup on the green band.
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-green">
      <Container className="flex h-[90px] items-center gap-7">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/brand/lockup-horizontal-reversed.svg"
            alt="No Better Time to Escape the Noise — Caravan Industry Association of Australia"
            width={210}
            height={64}
            className="h-16 w-auto"
            priority
          />
        </Link>
        <nav className="ml-3.5 flex flex-wrap items-center gap-0.5">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm text-sand transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {/* Hidden during design iteration — dealer-search element:
        <Button
          href="#"
          className="ml-auto shrink-0 whitespace-nowrap rounded-[9px] px-[19px] py-[11px] text-sm"
        >
          Visit a Dealer →
        </Button>
        */}
      </Container>
    </header>
  );
}
