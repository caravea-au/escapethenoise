import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MobileMenu } from "@/components/Navbar/MobileMenu";
import { getHeader, strapiMedia, type StrapiLink } from "@/lib/strapi";

// Find a Dealer nav entry (ETN-003), matching the export's header order.
// Prepended below rather than folded into FALLBACK_MENU alone: the live CMS
// `header.menuItems` is already populated (pre-dates /find-dealer existing),
// so the empty-array fallback below never fires for it — it must be added
// unconditionally, whichever menu source wins.
const FIND_A_DEALER_LINK: StrapiLink = { label: "Find a Dealer", url: "/find-dealer" };

// Fallback menu when Strapi is unset/unreachable. Guides-first nav (#10) —
// each topic deep-links to the Buying Guides listing with a category hash that
// auto-activates the matching filter chip and scrolls to the grid (matched by
// slugified category name; see BuyingGuidesExplorer).
const FALLBACK_MENU: StrapiLink[] = [
  FIND_A_DEALER_LINK,
  { label: "Find a Vehicle", url: "/vehicle-listings" },
  { label: "Education & Safety", url: "/buying-guides#education-safety" },
  { label: "Happy Campers", url: "/buying-guides#happy-campers" },
  { label: "Towing Guide", url: "/buying-guides#towing-guide" },
];

// Fallback CTA when Strapi's header.ctaButton is unset (live CMS state as of
// ETN-001/ETN-003) — matches the export's "Visit a Dealer →" header button.
const FALLBACK_CTA: StrapiLink = { label: "Visit a Dealer →", url: "/find-dealer" };

// Tier-2 — global header (design.md §4). Reversed lockup on the green band.
// Content comes from the Strapi `header` single type, with hardcoded fallbacks.
export async function Navbar() {
  const header = await getHeader();
  const cmsMenu = header?.menuItems?.length ? header.menuItems : FALLBACK_MENU;
  const menu = cmsMenu.some((l) => l.url === "/find-dealer")
    ? cmsMenu
    : [FIND_A_DEALER_LINK, ...cmsMenu];
  const logoSrc =
    strapiMedia(header?.logo?.url) ?? "/brand/lockup-horizontal-reversed.svg";
  const cta = header?.ctaButton?.label ? header.ctaButton : FALLBACK_CTA;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-green">
      <Container className="flex min-h-[90px] items-center gap-x-3 gap-y-2 py-3 md:gap-x-7">
        <Link href="/" className="flex shrink-0 items-center">
          {/* Dimensions are the lockup's true intrinsic size (viewBox 760x210).
              They were 210x64, a ratio the artwork never had, so the reserved
              box was ~90px narrower than the render. At h-16 the lockup is
              ~232px wide, which with the 44px hamburger and 24px gutters
              overflowed a 320px viewport, so step it down below md too. */}
          <Image
            src={logoSrc}
            alt="No Better Time to Escape the Noise — Caravan Industry Association of Australia"
            width={760}
            height={210}
            className="h-12 w-auto md:h-16"
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
          // Display-toggle classes live on this wrapper, not on Button itself:
          // Button's own base classes already include an unconditional
          // `inline-flex`, which wins the Tailwind cascade over a bare
          // `hidden` at equal specificity regardless of viewport, so passing
          // `hidden md:inline-flex` straight into Button's className never
          // actually hides it below md.
          <div className="ml-auto hidden shrink-0 md:inline-flex">
            <Button
              href={cta.url}
              className="whitespace-nowrap rounded-[9px] px-[19px] py-[11px] text-sm"
            >
              {cta.label}
            </Button>
          </div>
        )}
        <MobileMenu menu={menu} cta={cta ?? null} />
      </Container>
    </header>
  );
}
