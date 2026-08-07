import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { HomeOpenDay } from "@/lib/strapi";

// Fallbacks — the current hardcoded banner content, used when Strapi has no value.
const FALLBACK_BADGE = "12 July 2026 · Nationwide";
const FALLBACK_HEADING = "National Caravan Open Day";
const FALLBACK_CTA_LABEL = "Register Now →";
const FALLBACK_CTA_URL = "#";

// Open Day banner — single highlighted event CTA on the green band.
// NOT rendered anywhere yet: the hardcoded date above is already in the past
// and the client hasn't supplied a replacement date/registration URL. Wired up
// with Strapi plumbing so restoring it later (once real content lands) is a
// one-line change — add <OpenDayCTA data={home?.openDay} /> to the homepage.
export function OpenDayCTA({ data }: { data?: HomeOpenDay } = {}) {
  const badge = data?.badge ?? FALLBACK_BADGE;
  const heading = data?.heading ?? FALLBACK_HEADING;
  const ctaLabel = data?.ctaLabel ?? FALLBACK_CTA_LABEL;
  const ctaUrl = data?.ctaUrl ?? FALLBACK_CTA_URL;

  return (
    <section className="relative overflow-hidden bg-green">
      <div className="absolute inset-0 bg-[radial-gradient(80%_130%_at_85%_0%,rgba(193,124,44,.28),transparent_58%)]" />
      <Container className="relative flex flex-wrap items-center justify-between gap-7 py-12">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[15px] border border-gold/[.35] bg-gold/[.16]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-gold">
              <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[2px] text-gold">
              {badge}
            </div>
            <h3 className="mt-1.5 font-oswald text-[22px] font-semibold uppercase leading-[1.05] tracking-[-.3px] text-white md:text-[23px] lg:text-[31px] xl:text-[32px]">
              {heading}
            </h3>
          </div>
        </div>
        <Button href={ctaUrl} className="px-8 py-[17px] text-[15.5px]">
          {ctaLabel}
        </Button>
      </Container>
    </section>
  );
}
