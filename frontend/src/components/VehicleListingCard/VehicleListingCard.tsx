import Image from "next/image";
import type { VehicleListing } from "@/lib/strapi";
import { strapiMedia } from "@/lib/strapi";
import { Button } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

// Format a whole-dollar price like 18000 → "$18,000". Null → null.
function money(n: number | null): string | null {
  return typeof n === "number" ? `$${n.toLocaleString("en-AU")}` : null;
}

function priceRange(from: number | null, to: number | null): string | null {
  const lo = money(from);
  const hi = money(to);
  if (lo && hi) return `From ${lo} to ${hi}`;
  if (lo) return `From ${lo}`;
  return hi ? `Up to ${hi}` : null;
}

// Vehicle-type card for the finder grid: image, title, price range, feature
// bullets, then WATCH VIDEO (optional) + READ MORE. Not a whole-card link —
// it holds its own action buttons.
export function VehicleListingCard({ vehicle }: { vehicle: VehicleListing }) {
  const img = strapiMedia(vehicle.cardImage?.url);
  const price = priceRange(vehicle.priceFrom, vehicle.priceTo);
  const features = (vehicle.cardFeatures ?? []).slice(0, 3);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-[0_16px_44px_-16px_rgba(22,39,28,.11)]">
      <div className="relative h-[190px] w-full overflow-hidden bg-cream-deep">
        {img && (
          <Image
            src={img}
            alt={vehicle.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-[22px]">
        <Heading as="h3" className="text-[22px] leading-tight text-green uppercase tracking-[-0.2px]">
          {vehicle.title}
        </Heading>
        {price && (
          <Text variant="meta" className="font-semibold text-rust">
            {price}
          </Text>
        )}

        {features.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-2.5 p-0">
            {features.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-[1.5] text-ink">
                <svg
                  aria-hidden
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-[2px] shrink-0 text-rust"
                >
                  <path
                    d="M20 6 9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap gap-2.5 pt-3">
          {vehicle.watchVideoUrl && (
            <Button
              variant="secondary"
              href={vehicle.watchVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 text-sm"
            >
              Watch video
            </Button>
          )}
          <Button
            variant="primary"
            href={`/vehicle-listings/${vehicle.slug}`}
            className="px-4 py-2.5 text-sm"
          >
            Read more
          </Button>
        </div>
      </div>
    </article>
  );
}
