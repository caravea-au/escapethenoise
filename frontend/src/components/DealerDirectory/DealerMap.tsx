"use client";

// Reached only via `next/dynamic({ ssr: false })` from DealerDirectory, itself
// gated behind an IntersectionObserver — this file (and its ~230KB gzipped
// mapbox-gl chunk) is never fetched for a visitor who doesn't scroll to the
// map, or when there is no Mapbox token.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DirectoryDealer } from "@/lib/strapi";
import { dealerPoint, dealerPinType, prefersReducedMotion, haversineKm, type DealerOrigin } from "@/lib/dealers";
import { MapFallback } from "./MapFallback";
import { MapZoomControls } from "@/components/MapZoomControls/MapZoomControls";

// The v3 "standard" default style is a 3D style whose layers don't respond to
// setPaintProperty the way ours needs to — light-v11 is the flat vector style
// this recolouring logic is built for.
const STYLE_URL = "mapbox://styles/mapbox/light-v11";

// Australia-wide default view, used until the first fitBounds runs.
const DEFAULT_CENTER: [number, number] = [134.489, -25.734];
const DEFAULT_ZOOM = 3.4;

type PinType = "sales" | "service" | "rental";

const PIN_COLOUR_CLASS: Record<PinType, string> = {
  sales: "bg-rust",
  service: "bg-green",
  rental: "bg-service",
};

const PIN_LABEL: Record<PinType, string> = {
  sales: "Sales dealer",
  service: "Service centre",
  rental: "Rental only",
};

type MarkerEntry = {
  marker: mapboxgl.Marker;
  el: HTMLButtonElement;
  type: PinType;
};

type PortalTarget = { id: string; el: HTMLButtonElement; type: PinType };

type Props = {
  dealers: DirectoryDealer[];
  selectedId: string | null;
  onPinClick: (documentId: string) => void;
  mapboxToken: string;
  origin: DealerOrigin | null;
  // True while `origin` is null because the query didn't resolve (e.g.
  // "zzzzz"), as distinct from `origin` being null because the search was
  // cleared — the camera must not move for the former (AC2) but must
  // re-fit for the latter (AC3).
  unresolvedQuery: boolean;
};

function toLngLat(coords: [number, number]): [number, number] {
  // dealerPoint() returns [lat, lng]; Mapbox wants [lng, lat].
  return [coords[1], coords[0]];
}

function recolourStyle(map: mapboxgl.Map) {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const land = cs.getPropertyValue("--color-map-land").trim();
  const scrub = cs.getPropertyValue("--color-map-scrub").trim();
  const sand = cs.getPropertyValue("--color-map-sand").trim();
  const lineStrong = cs.getPropertyValue("--color-line-strong").trim();
  const labelColour = cs.getPropertyValue("--color-green").trim();

  const setPaint = (
    id: string,
    prop: "background-color" | "fill-color" | "line-color" | "text-color",
    value: string,
  ) => {
    if (!map.getLayer(id)) return;
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      // Layer exists but doesn't support this paint property (e.g. a fill
      // property on a line layer) — leave it at the style default rather
      // than throw and blank the map.
    }
  };

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    if (id === "background") {
      setPaint(id, "background-color", land);
    } else if (id === "landuse" || id === "landuse-overlay" || id.includes("park")) {
      setPaint(id, "fill-color", scrub);
    } else if (id === "water") {
      setPaint(id, "fill-color", sand);
    } else if (layer.type === "line" && id.startsWith("road")) {
      setPaint(id, "line-color", "white");
    } else if (layer.type === "line" && id.startsWith("admin")) {
      setPaint(id, "line-color", lineStrong);
    } else if (layer.type === "symbol" && id.includes("label")) {
      setPaint(id, "text-color", labelColour);
    }
  }
}

function PinContent({ type, selected }: { type: PinType; selected: boolean }) {
  const size = selected ? "h-[34px] w-[34px]" : "h-[26px] w-[26px]";
  return (
    <span className="relative block">
      {/* The halo carries no `-translate-x-1/2 -translate-y-1/2`: the ping2
          keyframes already apply `translate(-50%, -50%)`, and in Tailwind v4
          those utilities compile to the standalone `translate` property, which
          COMPOSES with `transform` rather than replacing it. With both, the
          halo was shifted twice and sat 15px up-left of the pin — which read as
          a second marker. Centring is left entirely to the keyframes. */}
      {selected && (
        <span className="absolute left-1/2 top-1/2 h-[30px] w-[30px] animate-ping2 rounded-full bg-rust/50" />
      )}
      {/* Centre the dot with flex, not margins. The export used `mx-auto mt-1.5`,
          a fixed 6px offset that only lines up at one pin size: the circular
          part of the teardrop is centred on the box, so a 26px pin (22px inside
          the 2px border) needs 6.5px and a selected 34px pin needs 10.5px. The
          fixed margin left the selected pin's dot 4.5px high — visibly off. */}
      <span
        className={`relative flex items-center justify-center rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white shadow-[0_4px_10px_rgba(22,39,28,.35)] ${size} ${PIN_COLOUR_CLASS[type]}`}
      >
        <span className="block h-[9px] w-[9px] rotate-45 rounded-full bg-white" />
      </span>
    </span>
  );
}

export function DealerMap({ dealers, selectedId, onPinClick, mapboxToken, origin, unresolvedQuery }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const userMovedMapRef = useRef(false);
  const prevIdsKeyRef = useRef<string | null>(null);
  // `undefined` is a "never ran" sentinel distinct from `null` (no origin) —
  // without it, mounting with no search in progress would look identical to
  // a just-cleared search and would fire the all-dealers re-fit below on
  // first render, duplicating the marker-diffing effect's own first-mount
  // fitBounds.
  const prevOriginKeyRef = useRef<string | null | undefined>(undefined);
  const onPinClickRef = useRef(onPinClick);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);

  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  // ---- Map init (once) -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = mapboxToken;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        cooperativeGestures: true,
        // Mapbox adds its own AttributionControl unless this is false. The
        // on-map credits are suppressed here and rendered as text in the map
        // legend instead — see the .mapboxgl-ctrl-bottom-right rule in
        // globals.css, and keep the legend's credit line.
        attributionControl: false,
        // Routes the wordmark into the bottom-right stack that globals.css
        // hides; the default bottom-left would leave it visible.
        logoPosition: "bottom-right",
      });
    } catch {
      // No WebGL2 (mapboxgl.supported() was removed in v3 — this try/catch
      // *is* the detection). The list must keep working without the map.
      setMapError(true);
      return;
    }
    mapRef.current = map;

    map.on("error", () => setMapError(true));
    map.on("style.load", () => recolourStyle(map));
    map.on("load", () => setMapReady(true));

    // Only a real user gesture (has `originalEvent`) counts as "moved the
    // map" — programmatic flyTo/fitBounds/zoomIn also fire these events and
    // must not permanently block future auto-fits.
    map.on("dragend", (e) => {
      if (e.originalEvent) userMovedMapRef.current = true;
    });
    map.on("zoomend", (e) => {
      // The mapbox-gl types erase `originalEvent` for zoomend specifically
      // (its declared type is unioned with `void`, which defeats the
      // `keyof` check the rest of the library relies on) — read it via an
      // assertion rather than losing the user-vs-programmatic distinction.
      const originalEvent = (e as unknown as { originalEvent?: WheelEvent | TouchEvent }).originalEvent;
      if (originalEvent) userMovedMapRef.current = true;
    });

    return () => {
      // Intentionally read live: markers are added by the separate diffing
      // effect below throughout the map's lifetime, so a snapshot taken here
      // (when the map has zero markers) would leak every marker added since.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const markers = markersRef.current;
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // A runtime error (bad token, quota) leaves a half-built map mounted with
  // nowhere to render — tear it down so cleanup doesn't run twice on unmount.
  useEffect(() => {
    if (!mapError || !mapRef.current) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    mapRef.current.remove();
    mapRef.current = null;
  }, [mapError]);

  // ---- Marker diffing + skipped-dealer count + guarded fitBounds -------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mapError) return;

    const nextIds = new Set<string>();
    const bounds = new mapboxgl.LngLatBounds();
    let hasBoundsPoint = false;
    let skipped = 0;

    for (const dealer of dealers) {
      const point = dealerPoint(dealer);
      if (!point) {
        skipped += 1;
        continue;
      }
      nextIds.add(dealer.documentId);
      const lngLat = toLngLat(point.coords);
      bounds.extend(lngLat);
      hasBoundsPoint = true;

      const existing = markersRef.current.get(dealer.documentId);
      if (existing) {
        existing.marker.setLngLat(lngLat);
        continue;
      }

      const type = dealerPinType(dealer.services);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "relative block cursor-pointer appearance-none border-0 bg-transparent p-0";
      el.setAttribute("aria-label", `${dealer.dealershipName} — ${PIN_LABEL[type]}`);
      el.addEventListener("click", (evt) => {
        evt.stopPropagation();
        onPinClickRef.current(dealer.documentId);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(lngLat).addTo(map);
      // mapbox-gl's Marker constructor sets role="img" on any element that
      // doesn't already carry a role attribute (it treats markers as static
      // icons) — that's wrong for a real <button>: it can make AT announce
      // it as a static graphic instead of an activatable control. The
      // existing aria-label already supplies the accessible name, so just
      // drop the role mapbox-gl added and let the button's implicit
      // role="button" stand.
      el.removeAttribute("role");
      markersRef.current.set(dealer.documentId, { marker, el, type });
    }

    for (const [id, entry] of markersRef.current) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }

    setSkippedCount(skipped);
    setPortalTargets(
      Array.from(markersRef.current.entries()).map(([id, { el, type }]) => ({ id, el, type })),
    );

    const idsKey = Array.from(nextIds).sort().join(",");
    // `dealers` gets a new array reference on re-sorts and other unrelated
    // re-renders (e.g. the mounted-clock effect), not just real filter
    // changes — re-running fitBounds on every one of those would interrupt
    // an in-flight camera animation for no reason. Only fit on first mount
    // or when the actual set of shown dealers changes.
    const isFirstRun = prevIdsKeyRef.current === null;
    const membershipChanged = idsKey !== prevIdsKeyRef.current;
    prevIdsKeyRef.current = idsKey;
    if (membershipChanged) userMovedMapRef.current = false;

    if (hasBoundsPoint && (isFirstRun || membershipChanged) && !userMovedMapRef.current) {
      try {
        map.stop();
        // Building this options object with an explicit `duration: undefined`
        // (e.g. `{ duration: reduced ? 0 : undefined }`) is NOT the same as
        // omitting the key: mapbox-gl merges options over its own defaults,
        // and an explicit `undefined` clobbers that default rather than
        // falling through to it. The animation then runs with a NaN
        // duration — no error, no 'moveend', but the transform's zoom is
        // silently left as NaN, which later poisons any flyTo/jumpTo. Only
        // set `duration` at all for the reduced-motion (instant) case.
        map.fitBounds(bounds, prefersReducedMotion() ? { padding: 60, maxZoom: 12, duration: 0 } : { padding: 60, maxZoom: 12 });
      } catch {
        // Defensive: keep whatever view the map already has rather than crash.
      }
    }
  }, [dealers, mapReady, mapError]);

  // ---- Card-selected -> flyTo -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mapError || !selectedId) return;
    const dealer = dealers.find((d) => d.documentId === selectedId);
    if (!dealer) return;
    const point = dealerPoint(dealer);
    if (!point) return;
    // Cleanly stop whatever's running (e.g. the initial fitBounds) before
    // starting a new camera move, rather than letting flyTo interrupt it.
    map.stop();
    const center = toLngLat(point.coords);
    const zoom = Math.max(map.getZoom(), 11);
    if (prefersReducedMotion()) {
      map.jumpTo({ center, zoom });
      return;
    }
    try {
      map.flyTo({ center, zoom, duration: 600 });
    } catch {
      // Defensive: fall back to an instant jump rather than leave the map
      // mid-crash if flyTo's animation curve ever hits a bad edge case.
      try {
        map.jumpTo({ center, zoom });
      } catch {
        // The transform itself is unrecoverable — degrade to the fallback
        // skin rather than risk this bubbling into the route's error
        // boundary. The dealer list keeps working regardless.
        setMapError(true);
      }
    }
  }, [selectedId, dealers, mapReady, mapError]);

  // ---- Search origin -> camera -------------------------------------------
  // `prevOriginKeyRef` means "the origin the camera was last moved to, or
  // null when it's currently showing all dealers" — NOT simply "the last
  // origin value seen". That distinction is what keeps an unresolved query
  // (camera stays exactly where it is) separate from a cleared search
  // (re-fit over everything shown).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || mapError) return;

    // An unresolved query (e.g. "zzzzz") also renders origin === null, same
    // as a genuine clear — but the camera must stay exactly where it was
    // while the "couldn't find that location" notice shows, rather than
    // yanking the user back out to the full map on a typo.
    // Bail out WITHOUT writing prevOriginKeyRef: the ref tracks where the
    // camera actually is, so leaving it untouched means a later genuine
    // clear still sees a real change from it and re-fits correctly.
    if (origin === null && unresolvedQuery) return;

    // Gate on the origin's COORDS, not the object or label. `dealers` gets a
    // brand-new array reference on unrelated re-renders (re-sorts, the
    // mounted-clock effect) — keying on coords rather than reference means
    // `dealers` can stay in the dep array below without re-firing the
    // camera. Search is also debounced (commitSearch), so a resolved origin
    // that hasn't actually changed between commits must not restart the
    // animation either.
    const originKey = origin ? `${origin.coords[0]},${origin.coords[1]}` : null;
    const isFirstRun = prevOriginKeyRef.current === undefined;
    const changed = originKey !== prevOriginKeyRef.current;
    prevOriginKeyRef.current = originKey;

    // A plain first mount with no search yet has nowhere to move to — skip.
    // But DealerMap mounts lazily behind an IntersectionObserver
    // (`mapVisible` in DealerDirectory), so a user can commit a search
    // before the map has ever scrolled into view, mounting with `origin`
    // already set — that case must still fly to it. This effect runs after
    // (and its map.stop() cancels) the marker-diffing effect's own
    // first-mount fitBounds over all dealers: the same double-fire-then-
    // settle-on-the-last-one pattern the card-selected flyTo effect already
    // relies on when it mounts with a pre-selected dealer.
    if (isFirstRun && origin === null) return;
    if (!isFirstRun && !changed) return;

    // A committed search (or "Near Me") is explicit user intent and must
    // override a previous manual pan/zoom — otherwise this would silently
    // do nothing for anyone who had already dragged the map before searching.
    userMovedMapRef.current = false;

    const bounds = new mapboxgl.LngLatBounds();
    let hasBoundsPoint = false;

    if (origin) {
      // origin.coords is [lat, lng], same order as dealerPoint() — both need
      // toLngLat() for Mapbox. haversineKm below takes the unconverted
      // [lat, lng] form.
      bounds.extend(toLngLat(origin.coords));
      hasBoundsPoint = true;

      const nearest = dealers
        .map((d) => {
          const point = dealerPoint(d);
          return point ? { coords: point.coords, km: haversineKm(origin.coords, point.coords) } : null;
        })
        .filter((x): x is { coords: [number, number]; km: number } => x !== null)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      for (const { coords } of nearest) {
        bounds.extend(toLngLat(coords));
      }
    } else {
      // Genuine clear (origin went non-null -> null, with no unresolved
      // query): re-fit over everything currently shown rather than
      // stranding the camera at the old search location.
      for (const dealer of dealers) {
        const point = dealerPoint(dealer);
        if (!point) continue;
        bounds.extend(toLngLat(point.coords));
        hasBoundsPoint = true;
      }
    }

    if (!hasBoundsPoint) return;

    map.stop();
    try {
      // Same duration ladder as the marker-diffing effect's fitBounds: only
      // set `duration` at all for the reduced-motion (instant) case, never
      // explicit `undefined`, which clobbers mapbox-gl's own default and
      // poisons the transform with a NaN zoom.
      map.fitBounds(
        bounds,
        prefersReducedMotion() ? { padding: 60, maxZoom: 12, duration: 0 } : { padding: 60, maxZoom: 12 },
      );
    } catch {
      try {
        // Only the origin fit implies a close zoom is correct — the cleared
        // case's bounds can span the whole shown dealer set, so forcing
        // zoom: 12 there would slam an Australia-wide view down to street
        // level. Keep whatever zoom the map already has instead.
        if (origin) {
          map.jumpTo({ center: bounds.getCenter(), zoom: 12 });
        } else {
          map.jumpTo({ center: bounds.getCenter() });
        }
      } catch {
        setMapError(true);
      }
    }
  }, [origin, unresolvedQuery, dealers, mapReady, mapError]);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  if (mapError) {
    return <MapFallback variant="error" />;
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-card" />

      {portalTargets.map(({ id, el, type }) =>
        createPortal(<PinContent key={id} type={type} selected={id === selectedId} />, el),
      )}

      <MapZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />

      <div
        aria-label="Map legend"
        className="absolute bottom-3.5 left-3.5 max-w-[220px] rounded-[11px] bg-white px-[15px] py-[13px] shadow-[0_6px_18px_rgba(22,39,28,.16)]"
      >
        <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[1px] text-green">Map Legend</div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-tag">
          <span className="inline-block h-[13px] w-[13px] shrink-0 rotate-[-45deg] rounded-[50%_50%_50%_0] bg-rust" />
          Sales Dealer
        </div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-tag">
          <span className="inline-block h-[13px] w-[13px] shrink-0 rotate-[-45deg] rounded-[50%_50%_50%_0] bg-green" />
          Service Centre
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-tag">
          <span className="inline-block h-[13px] w-[13px] shrink-0 rotate-[-45deg] rounded-[50%_50%_50%_0] bg-service" />
          Rental Only
        </div>
        {/* The only place the map credits now appear — the on-map control
            stack is hidden in globals.css. Do not remove: ODbL requires the
            OpenStreetMap credit for the dealer geocodes we store and show, and
            CC BY 4.0 requires the GeoNames credit (a link is the form the
            licence itself names) for the postcode/suburb data the location
            search resolves against. */}
        <div className="mt-2.5 border-t border-line pt-2 text-[10.5px] leading-[1.4] text-muted">
          © Mapbox © OpenStreetMap contributors{" "}
          <a href="https://www.geonames.org" target="_blank" rel="noreferrer" className="underline">
            © GeoNames
          </a>
          {skippedCount > 0 && (
            <>
              {" "}
              · {skippedCount} dealer{skippedCount === 1 ? "" : "s"} not shown (no location data)
            </>
          )}
        </div>
      </div>
    </div>
  );
}
