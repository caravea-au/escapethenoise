import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getFooter, strapiMedia, type StrapiLink } from "@/lib/strapi";

// Fallbacks when Strapi is unset/unreachable.
const FALLBACK_HEADING = "Find a Dealer";
const FALLBACK_CONTENT =
  "The official dealer directory of the Caravan Industry Association of Australia.";
const FALLBACK_COPYRIGHT =
  "© 2026 Caravan Industry Association of Australia · escapethenoise.com.au · 1300 555 000";
const FALLBACK_LEGAL: StrapiLink[] = [
  { label: "Privacy", url: "#" },
  { label: "Terms", url: "#" },
  { label: "Accessibility", url: "#" },
];

// Tier-2 — global footer (design.md §4). Content comes from the Strapi `footer`
// single type, with hardcoded fallbacks so the site never renders empty.
export async function Footer() {
  const footer = await getFooter();
  const heading = footer?.heading ?? FALLBACK_HEADING;
  const content = footer?.content ?? FALLBACK_CONTENT;
  const copyright = footer?.copyright ?? FALLBACK_COPYRIGHT;
  const columns = footer?.columns ?? [];
  const states = footer?.states ?? [];
  const statesLabel = footer?.statesLabel ?? "Browse by state:";
  const legal = footer?.legalLinks?.length ? footer.legalLinks : FALLBACK_LEGAL;
  const logoUrl = strapiMedia(footer?.logo?.url);

  return (
    <footer className="bg-green text-sand">
      <Container className="grid grid-cols-1 gap-9 pt-14 pb-[30px] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="min-w-[200px]">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={heading}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0"
              />
            ) : (
              <svg width="40" height="40" viewBox="0 0 220 220" className="shrink-0" aria-hidden="true">
                <defs>
                  <clipPath id="ftrClip">
                    <circle cx="110" cy="110" r="86" />
                  </clipPath>
                </defs>
                <g clipPath="url(#ftrClip)">
                  <path d="M24,150 Q70,108 120,144 Q160,172 196,148 L196,196 L24,196 Z" fill="#EFE7D2" />
                </g>
                <circle cx="110" cy="118" r="33" fill="none" stroke="#EFE7D2" strokeWidth="4" />
                <g stroke="#EFE7D2" strokeWidth="4" strokeLinecap="round">
                  <line x1="110" y1="68" x2="110" y2="57" />
                  <line x1="80" y1="76" x2="73" y2="67" />
                  <line x1="140" y1="76" x2="147" y2="67" />
                </g>
                <circle cx="110" cy="110" r="86" fill="none" stroke="#EFE7D2" strokeWidth="4" />
              </svg>
            )}
            <div className="font-oswald text-[19px] font-semibold uppercase tracking-[1px] text-white">
              {heading}
            </div>
          </div>
          <p className="mt-3.5 max-w-[280px] text-[13px] leading-[1.6] text-[#b3a98d]">
            {content}
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <div className="mb-3.5 font-oswald text-sm font-semibold uppercase tracking-[1px] text-white">
              {col.title}
            </div>
            <div className="flex flex-col gap-[9px] text-[13.5px] text-[#b3a98d]">
              {(col.links ?? []).map((l) => (
                <Link key={l.label} href={l.url} className="hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Container>

      {states.length > 0 && (
        <Container>
          <div className="flex flex-wrap gap-3 border-t border-white/10 py-[18px] text-[12.5px] text-[#b3a98d]">
            <span className="font-semibold text-sand">{statesLabel}</span>
            {states.map((s, i) => (
              <span key={s.label} className="flex gap-3">
                {i > 0 && <span aria-hidden="true">·</span>}
                <Link href={s.url} className="hover:text-white">
                  {s.label}
                </Link>
              </span>
            ))}
          </div>
        </Container>
      )}

      <Container>
        <div className="flex flex-wrap justify-between gap-3.5 border-t border-white/10 pt-[18px] pb-1 text-xs text-[#9c9277]">
          <span>{copyright}</span>
          <span className="flex gap-4">
            {legal.map((l) => (
              <Link key={l.label} href={l.url} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </span>
        </div>
      </Container>
    </footer>
  );
}
