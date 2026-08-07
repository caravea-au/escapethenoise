"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import type { DirectoryDealer } from "@/lib/strapi";
import {
  applyFilters,
  deriveFilterOptions,
  prefersReducedMotion,
  resolveOriginFromQuery,
  SORTS,
  CHIP_PREDICATES,
  type ChipKey,
  type DealerFilters,
  type DealerOrigin,
  type SortKey,
} from "@/lib/dealers";
import { FilterBar } from "./FilterBar";
import { ResultsHeader } from "./ResultsHeader";
import { DealerCard } from "./DealerCard";
import { DealerModal } from "./DealerModal";
import { MapFallback } from "./MapFallback";

// ssr:false is only legal inside a client component, which is what this is —
// keeps the ~230KB gzipped mapbox-gl chunk out of the server bundle entirely.
const DealerMap = dynamic(() => import("./DealerMap").then((m) => m.DealerMap), {
  ssr: false,
  loading: () => <MapFallback variant="loading" />,
});

const CHIP_KEYS = Object.keys(CHIP_PREDICATES) as ChipKey[];
const NO_LOCATION_NOTICE = "We couldn't get your location. Enter a suburb or postcode instead.";
const NO_MATCH_NOTICE = "We couldn't find that location. Try a nearby suburb or postcode.";

type Props = {
  dealers: DirectoryDealer[];
  initialFilters: DealerFilters;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string | null;
  mapboxToken: string | null;
  // See find-dealer/page.tsx — true only when the config fetch itself failed.
  recaptchaConfigError?: boolean;
};

export function DealerDirectory({
  dealers,
  initialFilters,
  recaptchaEnabled,
  recaptchaSiteKey,
  mapboxToken,
  recaptchaConfigError = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- URL-synced filters (single source of truth = the URL) --------------
  const qParam = searchParams.get("q") ?? "";
  const stateParam = searchParams.get("state") ?? initialFilters.state ?? "";
  const brandParam = searchParams.get("brand") ?? initialFilters.brand ?? "";
  const typeParam = searchParams.get("type") ?? initialFilters.productType ?? "";
  const serviceParam = searchParams.get("service") ?? initialFilters.service ?? "";
  const chipParamRaw = searchParams.get("chip");
  const chipParam: ChipKey | null =
    (chipParamRaw && CHIP_KEYS.includes(chipParamRaw as ChipKey) ? (chipParamRaw as ChipKey) : null) ??
    initialFilters.chips?.[0] ??
    null;
  const sortParamRaw = searchParams.get("sort");

  const pushParams = useCallback(
    (next: Partial<{ q: string; state: string; brand: string; type: string; service: string; chip: string; sort: string }>) => {
      const merged = {
        q: next.q ?? qParam,
        state: next.state ?? stateParam,
        brand: next.brand ?? brandParam,
        type: next.type ?? typeParam,
        service: next.service ?? serviceParam,
        chip: next.chip ?? (chipParam ?? ""),
        sort: next.sort ?? (sortParamRaw ?? ""),
      };
      const usp = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        if (value) usp.set(key, value);
      }
      const qs = usp.toString();
      // push (not replace): each user-initiated filter commit — dropdown
      // change, chip click, sort change, search submit, clear-all — should
      // land its own history entry so Back/Forward step through the filter
      // journey one change at a time (see BUG 1).
      router.push(`/find-dealer${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, qParam, stateParam, brandParam, typeParam, serviceParam, chipParam, sortParamRaw],
  );

  // ---- Ephemeral state ------------------------------------------------------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalDealer, setModalDealer] = useState<DirectoryDealer | null>(null);
  const [geoOrigin, setGeoOrigin] = useState<DealerOrigin | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(qParam);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map: gate the mapbox-gl chunk behind visibility so mobile users who never
  // scroll to it never fetch it. cardRefs lets a pin click scroll its list
  // card into view.
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (mapVisible || !mapSectionRef.current) return;
    const el = mapSectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mapVisible]);

  // Mounted clock — "open now" depends on the viewer's clock + the dealer's
  // timezone, and this page is ISR-cached, so it must only be derived after
  // mount or the server/client render will disagree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const queryOrigin = useMemo(() => resolveOriginFromQuery(qParam, dealers), [qParam, dealers]);
  const origin = geoOrigin ?? queryOrigin;
  // Derived straight from the URL (not local state) so the notice shows
  // however `q` got there — typed + Enter, a shared link, or Back/Forward —
  // and clears itself the moment `q` is cleared or resolves (BUG 2).
  const queryNotice = qParam.trim() && !queryOrigin ? NO_MATCH_NOTICE : null;

  function commitSearch() {
    const trimmed = searchInput.trim();
    setGeoOrigin(null);
    setGeoNotice(null);
    pushParams({ q: trimmed });
  }

  function handleNearMe() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoOrigin(null);
      setGeoNotice(NO_LOCATION_NOTICE);
      searchInputRef.current?.focus();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoNotice(null);
        setGeoOrigin({ coords: [pos.coords.latitude, pos.coords.longitude], label: "your location" });
      },
      () => {
        setGeoOrigin(null);
        setGeoNotice(NO_LOCATION_NOTICE);
        searchInputRef.current?.focus();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  // ---- Filtering / sorting ---------------------------------------------------
  const options = useMemo(() => deriveFilterOptions(dealers), [dealers]);

  const baseFilters: DealerFilters = useMemo(
    () => ({
      state: stateParam || undefined,
      brand: brandParam || undefined,
      productType: typeParam || undefined,
      service: serviceParam || undefined,
    }),
    [stateParam, brandParam, typeParam, serviceParam],
  );

  // Avoid a hydration mismatch: only apply the "Open Now" chip once `now` is
  // known client-side. Everything else in `baseFilters` is time-independent.
  const activeChips: ChipKey[] = useMemo(
    () => (chipParam ? (chipParam === "Open Now" && now === null ? [] : [chipParam]) : []),
    [chipParam, now],
  );

  const allCount = useMemo(
    () => applyFilters(dealers, baseFilters, now ?? 0).length,
    [dealers, baseFilters, now],
  );

  const filtered = useMemo(
    () => applyFilters(dealers, { ...baseFilters, chips: activeChips }, now ?? 0),
    [dealers, baseFilters, activeChips, now],
  );

  const sort: SortKey = origin ? (sortParamRaw === "name" ? "name" : "distance") : "name";
  const sorted = useMemo(() => SORTS[sort](filtered, origin?.coords ?? null), [filtered, sort, origin]);

  function handleSortChange(value: SortKey) {
    const defaultForOrigin: SortKey = origin ? "distance" : "name";
    pushParams({ sort: value === defaultForOrigin ? "" : value });
  }

  function handleChipSelect(chip: ChipKey | null) {
    pushParams({ chip: chip ?? "" });
  }

  // A pin click selects the dealer, opens its modal, and scrolls its card
  // into view in the results list — mirrors a card's own onOpenModal.
  const handlePinClick = useCallback(
    (documentId: string) => {
      const dealer = sorted.find((d) => d.documentId === documentId);
      if (!dealer) return;
      setSelectedId(documentId);
      setModalDealer(dealer);
      cardRefs.current.get(documentId)?.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [sorted],
  );

  if (dealers.length === 0) {
    return (
      <Container width="marketing" className="py-16">
        <div className="rounded-card border border-line bg-white px-6 py-10 text-center">
          <Heading as="h2" className="text-[22px] text-green">
            No accredited dealers listed yet
          </Heading>
          <Text variant="lead" className="mx-auto mt-2.5 max-w-[520px] text-muted">
            Check back again soon — or if you run a dealership, get listed today.
          </Text>
          <Button href="/dealer-directory-onboarding" variant="primary" className="mt-6">
            List your dealership
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <div>
      <section className="static border-b border-line bg-white md:sticky md:top-[90px] md:z-30">
        <FilterBar
          searchInputRef={searchInputRef}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchSubmit={commitSearch}
          options={options}
          stateValue={stateParam}
          onStateChange={(v) => pushParams({ state: v })}
          brandValue={brandParam}
          onBrandChange={(v) => pushParams({ brand: v })}
          typeValue={typeParam}
          onTypeChange={(v) => pushParams({ type: v })}
          serviceValue={serviceParam}
          onServiceChange={(v) => pushParams({ service: v })}
          onNearMe={handleNearMe}
          activeChip={chipParam}
          onChipSelect={handleChipSelect}
          allCount={allCount}
        />
      </section>

      {(geoNotice || queryNotice) && (
        <Container width="marketing" className="pt-4">
          <p role="status" className="rounded-input border border-line bg-cream px-4 py-3 text-[13.5px] text-muted">
            {geoNotice ?? queryNotice}
          </p>
        </Container>
      )}

      <Container width="marketing" className="py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div
            ref={mapSectionRef}
            className="h-[300px] overflow-hidden rounded-card border border-line-strong md:h-[380px] lg:h-[620px] lg:flex-[1_1_540px]"
          >
            {!mapboxToken ? (
              <MapFallback variant="unavailable" />
            ) : !mapVisible ? (
              <MapFallback variant="loading" />
            ) : (
              <DealerMap
                dealers={sorted}
                selectedId={selectedId}
                onPinClick={handlePinClick}
                mapboxToken={mapboxToken}
              />
            )}
          </div>

          <div className="min-w-0 lg:max-h-[1000px] lg:flex-[1_1_380px] lg:overflow-auto lg:overscroll-contain">
            <ResultsHeader
              count={sorted.length}
              originLabel={origin?.label ?? null}
              sort={sort}
              sortDisabled={!origin}
              onSortChange={handleSortChange}
            />

            {sorted.length === 0 ? (
              <div className="rounded-card border border-line bg-white px-6 py-10 text-center">
                <Text variant="lead" className="text-muted">
                  No dealers match these filters.
                </Text>
                <Button variant="secondary" href="/find-dealer" className="mt-4">
                  Clear all filters
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-[13px]">
                {sorted.map((d) => (
                  <div
                    key={d.documentId}
                    ref={(el) => {
                      if (el) cardRefs.current.set(d.documentId, el);
                      else cardRefs.current.delete(d.documentId);
                    }}
                  >
                    <DealerCard
                      dealer={d}
                      now={now}
                      origin={origin}
                      selected={selectedId === d.documentId}
                      onSelect={() => setSelectedId(d.documentId)}
                      onOpenModal={() => {
                        setSelectedId(d.documentId);
                        setModalDealer(d);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>

      {modalDealer && (
        <DealerModal
          dealer={modalDealer}
          now={now}
          origin={origin}
          recaptchaEnabled={recaptchaEnabled}
          recaptchaSiteKey={recaptchaSiteKey}
          recaptchaConfigError={recaptchaConfigError}
          onClose={() => setModalDealer(null)}
        />
      )}
    </div>
  );
}
