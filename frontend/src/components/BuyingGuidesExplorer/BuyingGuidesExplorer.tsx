"use client";

import { useMemo, useState } from "react";
import type { BuyingGuide } from "@/lib/strapi";
import { GuideCard } from "@/components/GuideCard/GuideCard";

const ALL = "All Topics";

// Category chips + the grid they filter. Client island for the listing page.
export function BuyingGuidesExplorer({ guides }: { guides: BuyingGuide[] }) {
  const categories = useMemo(
    () => [
      ALL,
      ...Array.from(
        new Set(guides.map((g) => g.category).filter((c): c is string => Boolean(c))),
      ),
    ],
    [guides],
  );
  const [active, setActive] = useState(ALL);
  const visible = active === ALL ? guides : guides.filter((g) => g.category === active);

  return (
    <>
      <div className="mb-[34px] flex flex-wrap gap-[9px]">
        {categories.map((cat) => {
          const on = cat === active;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(cat)}
              className={`rounded-chip px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust motion-reduce:transition-none ${
                on
                  ? "bg-green text-white"
                  : "border border-line bg-white text-tag hover:border-rust"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => (
          <GuideCard key={g.id} guide={g} />
        ))}
      </div>
    </>
  );
}
