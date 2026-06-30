import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Heading } from "@/components/ui/Heading";
import { Button } from "@/components/ui/Button";
import type { HomeJourney } from "@/lib/strapi";

const SearchIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
    <circle cx="11" cy="11" r="2.4" />
  </svg>
);
const CompassIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4z" />
  </svg>
);
const CalendarIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
const VanIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 13h11v3H3zM14 11h3.5l2.5 3v2h-6z" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17.5" cy="17.5" r="1.8" />
  </svg>
);

// Icon key → SVG. Strapi supplies the key (enum); the markup stays in the frontend.
const ICONS = {
  search: SearchIcon,
  compass: CompassIcon,
  calendar: CalendarIcon,
  van: VanIcon,
} as const;
type IconKey = keyof typeof ICONS;

// Fallbacks — the current hardcoded journey content, used when Strapi has no value.
const FALLBACK_EYEBROW = "Your journey starts here";
const FALLBACK_HEADING = "What are you looking for?";
const FALLBACK_CARDS = [
  { icon: "search", title: "Find a Dealer", body: "Locate your nearest accredited caravan dealer by suburb, state or brand.", ctaLabel: "Search Dealers →", ctaUrl: null, featured: false },
  { icon: "compass", title: "First Time Buyer?", body: "Start your caravan journey with our complete beginner's guide.", ctaLabel: "Start Learning →", ctaUrl: null, featured: true },
  { icon: "calendar", title: "Upcoming Events", body: "Open Days, Shows and National Events near you.", ctaLabel: "View Events →", ctaUrl: null, featured: false },
  { icon: "van", title: "Buying Guides", body: "Independent, jargon-free advice on van types, towing, weights and buying with confidence.", ctaLabel: "Read the Guides →", ctaUrl: "/buying-guides", featured: false },
] as const;

// "What are you looking for?" — four entry-point cards (one featured in rust).
export function JourneySection({ data }: { data?: HomeJourney }) {
  const eyebrow = data?.eyebrow ?? FALLBACK_EYEBROW;
  const heading = data?.heading ?? FALLBACK_HEADING;
  const cards = data?.cards?.length ? data.cards : FALLBACK_CARDS;

  return (
    <Container className="pt-[104px] pb-9 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading as="h2" className="mt-2.5 text-[28px] text-green md:text-[31px] lg:text-[40px]">
        {heading}
      </Heading>

      <div className="mt-[42px] grid grid-cols-[repeat(auto-fit,minmax(232px,1fr))] gap-5 text-left">
        {cards.map((card, i) => {
          const icon = card.icon ? ICONS[card.icon as IconKey] : null;
          const href = card.ctaUrl;
          return (
            <div
              key={card.title ?? i}
              className="group flex flex-col rounded-[18px] border-[1.5px] border-line bg-white p-7 shadow-[0_16px_44px_-18px_rgba(22,39,28,.11)] transition-all duration-[400ms] hover:-translate-y-1.5 hover:border-rust hover:shadow-[0_22px_50px_-16px_rgba(193,124,44,.30)]"
            >
              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-green text-gold transition-colors duration-[400ms] group-hover:bg-rust group-hover:text-white">
                {icon}
              </div>
              <h3 className="mt-[18px] font-oswald text-[19px] font-bold text-green">{card.title}</h3>
              <p className="mt-2 min-h-[62px] text-sm leading-[1.55] text-muted">{card.body}</p>
              {href ? (
                <Button
                  href={href}
                  variant="secondary"
                  fullWidth
                  className="mt-4 rounded-[9px] py-3 text-sm group-hover:border-rust group-hover:bg-rust group-hover:text-white"
                >
                  {card.ctaLabel}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled
                  className="mt-4 cursor-not-allowed rounded-[9px] py-3 text-sm opacity-60 group-hover:border-rust group-hover:bg-rust group-hover:text-white"
                >
                  {card.ctaLabel}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Container>
  );
}
