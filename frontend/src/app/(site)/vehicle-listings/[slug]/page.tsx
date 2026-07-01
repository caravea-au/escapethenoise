import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { ArticleBody } from "@/components/ArticleBody/ArticleBody";
import {
  getVehicleListingBySlug,
  getVehicleListingSlugs,
  strapiMedia,
  type VehicleIcon,
  type VehicleListItem,
  type VehicleSpecSection,
} from "@/lib/strapi";

const SURVEY_URL =
  "https://letsgocaravan.typeform.com/to/LEDXVhmR?utm_source=letsgowebsite&utm_medium=vehiclequizpg&utm_campaign=caravanbuyersservice";

export async function generateStaticParams() {
  const slugs = await getVehicleListingSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleListingBySlug(slug);
  if (!vehicle) return {};
  return {
    title: vehicle.seo?.metaTitle ?? vehicle.title,
    description: vehicle.seo?.metaDescription ?? undefined,
  };
}

// Curated icon set for spec items. Distinct glyphs for the common amenities;
// anything else (or a bullet) falls back to a check. Inline (Tier-3) — only
// this page needs it.
function SpecIcon({ name }: { name: VehicleIcon | null }) {
  const common = {
    "aria-hidden": true,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "mt-[2px] shrink-0 text-rust",
  };
  switch (name) {
    case "water":
      return (
        <svg {...common}>
          <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
        </svg>
      );
    case "solar":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="10" rx="1" />
          <path d="M8 5v10M12 5v10M16 5v10M9 19h6M12 15v4" />
        </svg>
      );
    case "battery":
    case "power":
      return (
        <svg {...common}>
          <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />
        </svg>
      );
    case "bed":
      return (
        <svg {...common}>
          <path d="M3 8v10M3 12h18v6M21 12v6M7 12V9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3" />
        </svg>
      );
    case "storage":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M4 12h16M11 8h2M11 16h2" />
        </svg>
      );
    case "aircon":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="8" rx="2" />
          <path d="M7 17c0 1.5 1 2 1 3M12 17c0 1.5 1 2 1 3M17 17c0 1.5 1 2 1 3" />
        </svg>
      );
    case "fridge":
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M6 10h12M10 6v2M10 13v3" />
        </svg>
      );
    case "kitchen":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <circle cx="15" cy="9" r="1.5" />
          <circle cx="9" cy="15" r="1.5" />
          <circle cx="15" cy="15" r="1.5" />
        </svg>
      );
    case "awning":
      return (
        <svg {...common}>
          <path d="M3 4h18v5H3zM3 9l4 4M9 9l4 4M15 9l4 4M4 20V13M20 20v-7" />
        </svg>
      );
    case "license":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8" cy="11" r="2" />
          <path d="M13 10h5M13 14h5M6 15h4" />
        </svg>
      );
    case "road":
      return (
        <svg {...common}>
          <path d="M8 3 4 21M16 3l4 18M12 4v2M12 10v2M12 16v2" />
        </svg>
      );
    default:
      return (
        <svg {...common} strokeWidth={2.2}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
  }
}

// A tidy bullet / icon line (why-choose list and spec-section items).
function IconLine({ item }: { item: VehicleListItem }) {
  return (
    <li className="flex gap-3 text-[16px] leading-[1.55] text-ink">
      <SpecIcon name={item.icon} />
      <span>{item.text}</span>
    </li>
  );
}

function SpecSection({ section }: { section: VehicleSpecSection }) {
  const items = section.items ?? [];
  return (
    <section className="mt-9">
      <Heading as="h3" className="mb-3 text-[22px] tracking-[-0.3px] text-green">
        {section.label}
      </Heading>
      {section.body && (
        <p className="mb-4 whitespace-pre-line text-[17px] leading-[1.72] text-ink">
          {section.body}
        </p>
      )}
      {items.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-3 p-0 sm:grid-cols-2">
          {items.map((it, i) => (
            <IconLine key={i} item={it} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function VehicleListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicleListingBySlug(slug);
  if (!vehicle) notFound();

  const hero = strapiMedia(vehicle.heroImage?.url);
  const whyChoose = vehicle.whyChoose ?? [];
  const specSections = vehicle.specSections ?? [];

  return (
    <article>
      {/* Hero */}
      <section className="relative isolate bg-green-dark">
        {hero && (
          <Image src={hero} alt={vehicle.title} fill sizes="100vw" priority className="object-cover" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-green-dark)_55%,transparent)_0%,color-mix(in_srgb,var(--color-green-dark)_70%,transparent)_55%,color-mix(in_srgb,var(--color-green-dark)_94%,transparent)_100%)]" />
        <Container width="article" className="relative pt-10 pb-[46px]">
          <Link
            href="/vehicle-listings"
            className="inline-flex items-center gap-[7px] text-[13.5px] font-bold text-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            ← Back to Vehicle Listings
          </Link>
          <Heading
            as="h1"
            className="mt-[18px] text-[30px] tracking-[-1px] text-balance text-white md:text-[40px] lg:text-[48px]"
          >
            {vehicle.title}
          </Heading>
        </Container>
      </section>

      <Container width="article" className="pt-12 pb-16">
        {/* Why choose */}
        {whyChoose.length > 0 && (
          <section>
            <Heading as="h2" className="mb-4 text-[25px] tracking-[-0.3px] text-green">
              Why choose a {vehicle.title}?
            </Heading>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {whyChoose.map((it, i) => (
                <IconLine key={i} item={it} />
              ))}
            </ul>
          </section>
        )}

        {/* Overview */}
        {(vehicle.overviewHeading || vehicle.overviewBody) && (
          <section className="mt-10">
            {vehicle.overviewHeading && (
              <Heading as="h2" className="mb-3.5 text-[25px] tracking-[-0.3px] text-green">
                {vehicle.overviewHeading}
              </Heading>
            )}
            {vehicle.overviewBody && <ArticleBody blocks={vehicle.overviewBody} />}
          </section>
        )}

        {/* Structured spec sections */}
        {specSections.map((s, i) => (
          <SpecSection key={i} section={s} />
        ))}

        {/* Find Your Perfect RV CTA */}
        <section className="mt-12 rounded-card border border-line bg-cream px-6 py-8 text-center sm:px-10">
          <Heading as="h2" className="text-[24px] text-green md:text-[28px]">
            Find your perfect RV with confidence
          </Heading>
          <Text variant="lead" className="mx-auto mt-2.5 max-w-[540px] text-tag">
            RV Finder is a free, easy-to-use service that connects you with trusted local RV
            dealers.
          </Text>
          <div className="mt-6 flex justify-center">
            <Button variant="primary" href={SURVEY_URL} target="_blank" rel="noopener noreferrer">
              Take the RV Finder quiz
            </Button>
          </div>
        </section>

        <div className="mt-9 border-t border-line pt-7">
          <Link
            href="/vehicle-listings"
            className="inline-flex items-center gap-[7px] text-sm font-semibold text-rust hover:text-rust-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust"
          >
            ← All Vehicle Listings
          </Link>
        </div>
      </Container>
    </article>
  );
}
