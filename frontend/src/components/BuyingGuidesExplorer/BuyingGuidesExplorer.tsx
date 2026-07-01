"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BuyingGuide } from "@/lib/strapi";
import { GuideCard } from "@/components/GuideCard/GuideCard";

const ALL = "All Topics";

// URL-safe form of a category name, e.g. "Education & Safety" -> "education-safety".
// Header nav links use this slug as a hash (#education-safety) to deep-link a filter,
// so it must match the slugs used in Navbar.tsx / seed-header-footer.mjs.
const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

  // slug → category, for resolving a URL hash to a filter.
  const bySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) if (c !== ALL) m.set(slug(c), c);
    return m;
  }, [categories]);

  const [active, setActive] = useState(ALL);
  const listingRef = useRef<HTMLDivElement>(null);

  // Drive the filter from the URL hash so navbar links like
  // `/buying-guides#happy-campers` select the category and scroll to the list.
  // The listing page never remounts on hash-only navigation, so we listen for
  // `hashchange` to react to repeated nav clicks.
  useEffect(() => {
    const applyHash = () => {
      const hash = slug(decodeURIComponent(window.location.hash.slice(1)));
      const cat = hash ? bySlug.get(hash) : undefined;
      setActive(cat ?? ALL);
      if (cat) listingRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    applyHash(); // honor a hash already present on first load
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [bySlug]);

  const visible = active === ALL ? guides : guides.filter((g) => g.category === active);

  // Chip click: update state and keep the URL shareable. replaceState (not
  // location.hash) avoids firing hashchange, so a chip click doesn't scroll.
  const select = (cat: string) => {
    setActive(cat);
    const url =
      cat === ALL ? window.location.pathname + window.location.search : `#${slug(cat)}`;
    window.history.replaceState(null, "", url);
  };

  return (
    <div ref={listingRef} className="scroll-mt-[90px]">
      <div className="mb-[34px] flex flex-wrap gap-[9px]">
        {categories.map((cat) => {
          const on = cat === active;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={on}
              onClick={() => select(cat)}
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
    </div>
  );
}
