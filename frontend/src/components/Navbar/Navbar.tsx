import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MobileMenu } from "@/components/Navbar/MobileMenu";
import { getHeader, strapiMedia, type StrapiLink } from "@/lib/strapi";

// Fallback menu when Strapi is unset/unreachable. Guides-first nav (#10) —
// each topic deep-links to the Buying Guides listing with a category hash that
// auto-activates the matching filter chip (matched by slugified category name).
const FALLBACK_MENU: StrapiLink[] = [
  { label: "Education & Safety", url: "/buying-guides#education-safety" },
  { label: "Happy Campers", url: "/buying-guides#happy-campers" },
  { label: "Towing Guide", url: "/buying-guides#towing-guide" },
];

// Tier-2 — global header (design.md §4). Reversed lockup on the green band.
// Content comes from the Strapi `header` single type, with hardcoded fallbacks.
export async function Navbar() {
  const header = await getHeader();
  const menu = header?.menuItems?.length ? header.menuItems : FALLBACK_MENU;
  const logoSrc =
    strapiMedia(header?.logo?.url) ?? "/brand/lockup-horizontal-reversed.svg";
  const cta = header?.ctaButton;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-green">
      <Container className="flex min-h-[90px] items-center gap-x-7 gap-y-2 py-3">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src={logoSrc}
            alt="No Better Time to Escape the Noise — Caravan Industry Association of Australia"
            width={210}
            height={64}
            className="h-16 w-auto"
            priority
          />
        </Link>
        <nav className="ml-3.5 hidden flex-wrap items-center gap-0.5 md:flex">
          {menu.map((l) => (
            <Link
              key={l.label}
              href={l.url}
              className="rounded-lg px-3.5 py-2 text-sm text-sand transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {cta?.label && (
          <Button
            href={cta.url}
            className="ml-auto hidden shrink-0 whitespace-nowrap rounded-[9px] px-[19px] py-[11px] text-sm md:inline-flex"
          >
            {cta.label}
          </Button>
        )}
        <MobileMenu menu={menu} cta={cta ?? null} />
      </Container>
    </header>
  );
}
