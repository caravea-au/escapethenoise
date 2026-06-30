import Link from "next/link";
import { Container } from "@/components/ui/Container";

const COLUMNS = [
  // Hidden during design iteration — dealer-search column:
  // {
  //   title: "Find a Dealer",
  //   links: ["Search dealers", "Near me", "Special offers", "Open now"],
  // },
  {
    title: "Resources",
    links: ["Buying guides", "Towing guide", "Events & shows", "Safety advice"],
  },
  {
    title: "About CIAA",
    links: ["About us", "Accreditation", "For dealers", "Contact"],
  },
];

// Hidden during design iteration — "Browse by state" row:
// const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

// Tier-2 — global footer (design.md §4).
export function Footer() {
  return (
    <footer className="bg-green text-sand">
      <Container className="grid grid-cols-1 gap-9 pt-14 pb-[30px] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="min-w-[200px]">
          <div className="flex items-center gap-3">
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
            <div className="font-oswald text-[19px] font-semibold uppercase tracking-[1px] text-white">
              Find a Dealer
            </div>
          </div>
          <p className="mt-3.5 max-w-[280px] text-[13px] leading-[1.6] text-[#b3a98d]">
            The official dealer directory of the Caravan Industry Association of Australia.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="mb-3.5 font-oswald text-sm font-semibold uppercase tracking-[1px] text-white">
              {col.title}
            </div>
            <div className="flex flex-col gap-[9px] text-[13.5px] text-[#b3a98d]">
              {col.links.map((l) => (
                <Link key={l} href="#" className="hover:text-white">
                  {l}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Container>

      {/* Hidden during design iteration — "Browse by state" row:
      <Container>
        <div className="flex flex-wrap gap-3 border-t border-white/10 py-[18px] text-[12.5px] text-[#b3a98d]">
          <span className="font-semibold text-sand">Browse by state:</span>
          {STATES.map((s, i) => (
            <span key={s} className="flex gap-3">
              {i > 0 && <span aria-hidden="true">·</span>}
              {s}
            </span>
          ))}
        </div>
      </Container>
      */}

      <Container>
        <div className="flex flex-wrap justify-between gap-3.5 border-t border-white/10 pt-[18px] pb-1 text-xs text-[#9c9277]">
          <span>© 2026 Caravan Industry Association of Australia · escapethenoise.com.au · 1300 555 000</span>
          <span className="flex gap-4">
            <Link href="#" className="hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-white">Terms</Link>
            <Link href="#" className="hover:text-white">Accessibility</Link>
          </span>
        </div>
      </Container>
    </footer>
  );
}
