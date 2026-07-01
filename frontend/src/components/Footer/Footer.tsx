import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getFooter, strapiMedia, type StrapiLink } from "@/lib/strapi";

// Linkify "Caravea" in the copyright line → the Caravea site. The copyright
// itself stays a plain Strapi string; this is presentation only.
function renderCopyright(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /Caravea/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={key++}
        href="https://caravea.au/"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1 align-middle hover:text-white"
      >
        <Image
          src="/brand/caravea-icon.svg"
          alt=""
          width={14}
          height={14}
          className="inline-block"
        />
        <span className="underline">Caravea</span>
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Fallbacks when Strapi is unset/unreachable.
const FALLBACK_HEADING = "Find a Dealer";
const FALLBACK_CONTENT =
  "No better time to\nBuy your caravan with confidence — not pressure";
const FALLBACK_COPYRIGHT =
  "© 2026 Caravan Industry Association of Australia | Powered by Caravea";
const FALLBACK_LEGAL: StrapiLink[] = [
  { label: "Privacy", url: "/privacy-policy" },
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
  // Match the header: same reversed lockup when Strapi has no footer logo set.
  const logoSrc =
    strapiMedia(footer?.logo?.url) ?? "/brand/lockup-horizontal-reversed.svg";

  return (
    <footer className="bg-green text-sand">
      <Container className="grid grid-cols-1 gap-9 pt-14 pb-[30px] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="min-w-[200px]">
          <Image
            src={logoSrc}
            alt={heading}
            width={210}
            height={64}
            className="h-14 w-auto"
          />
          <p className="mt-3.5 max-w-[280px] whitespace-pre-line text-[13px] leading-[1.6] text-[#b3a98d]">
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
          <span>{renderCopyright(copyright)}</span>
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
