"use client";

// The mapbox-gl half of the onboarding form's "confirm your location" field.
//
// Split out from LocationPin.tsx so it can be next/dynamic'd with ssr:false:
// mapbox-gl is ~230KB gzipped and must never land in the initial bundle of a
// form most visitors will not finish. LocationPin only mounts this once an
// address has actually resolved to a pin. Same discipline as DealerMap on
// /find-dealer — see DealerDirectory.tsx.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapFallback } from "@/components/DealerDirectory/MapFallback";
import { prefersReducedMotion } from "@/lib/dealers";

// Not the v3 default "standard" style: it is a 3D style that ignores
// setPaintProperty, and DealerMap already settled on flat vector light-v11.
// Kept identical so both maps read as the same product.
const STYLE_URL = "mapbox://styles/mapbox/light-v11";

// Building-level. The dealer is confirming which driveway is theirs, not
// browsing a region, so this starts much closer in than the directory map.
const DEFAULT_ZOOM = 17;

// One arrow press nudges the pin this far; hold Shift for the coarse step.
// Expressed in metres rather than degrees so the nudge feels the same at any
// latitude and does not need rescaling per zoom level.
const NUDGE_M = 5;
const NUDGE_SHIFT_M = 50;

const METRES_PER_DEG_LAT = 111_320;

type Props = {
  mapboxToken: string;
  lat: number;
  lng: number;
  /** Fired for any dealer-initiated move: drag, map click, or keyboard nudge. */
  onChange: (lat: number, lng: number) => void;
};

export function PinMap({ mapboxToken, lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [markerEl, setMarkerEl] = useState<HTMLElement | null>(null);
  const [mapError, setMapError] = useState(false);

  // Keeps the callback fresh without making the map-init effect depend on it
  // (a new function identity each render would tear the map down every time).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // The last position WE emitted. The sync effect below compares against this
  // so a drag doesn't get overwritten by the prop echoing back through the
  // parent, while a genuinely new geocode still moves the pin.
  const emittedRef = useRef<[number, number] | null>(null);

  const emit = useCallback((nextLat: number, nextLng: number) => {
    // 6dp is ~0.1m and matches what the backend stores; anything finer is noise
    // that would also defeat the equality check in the sync effect.
    const rounded: [number, number] = [
      Number(nextLat.toFixed(6)),
      Number(nextLng.toFixed(6)),
    ];
    emittedRef.current = rounded;
    onChangeRef.current(rounded[0], rounded[1]);
  }, []);

  // ---- Map init (once per token) ---------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = mapboxToken;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [lng, lat],
        zoom: DEFAULT_ZOOM,
        // Two fingers to pan on touch. Load-bearing here: this map sits inside a
        // long form, and a one-finger map would swallow the page scroll.
        cooperativeGestures: true,
        // Mapbox adds its OWN AttributionControl unless this is false, which is
        // what produced the duplicate credit bar fixed in #45. Credits are
        // rendered as text by LocationPin instead — ODbL still requires them.
        attributionControl: false,
        // Routes the wordmark into the bottom-right stack that globals.css
        // hides; the default bottom-left would leave it visible.
        logoPosition: "bottom-right",
      });
    } catch {
      // No WebGL2. mapboxgl.supported() was removed in v3, so this try/catch
      // IS the detection. The field must stay submittable without a map.
      setMapError(true);
      return;
    }
    mapRef.current = map;
    map.on("error", () => setMapError(true));

    // Mapbox makes the canvas a tab stop (tabindex=0, role=region) with its own
    // arrow-key handler that PANS THE CAMERA. That produced two visually
    // identical "map" tab stops before the marker, and arrowing on the first one
    // moved the view while the pin's actual coordinates never changed — a
    // keyboard user would watch the pin slide across the screen and reasonably
    // believe they had placed it. Panning is not needed to complete this field,
    // so remove both the handler and the tab stop and leave exactly one
    // focusable thing that moves the pin.
    map.keyboard.disable();
    map.getCanvas().removeAttribute("tabindex");

    const el = document.createElement("button");
    el.type = "button";
    // Not a div: the dealer must be able to reach and move this pin without a
    // mouse, and a real button is focusable and announced as actionable.
    el.className =
      "block cursor-grab appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green";
    el.setAttribute(
      "aria-label",
      "Your location pin. Drag it, or use the arrow keys to move it. Hold Shift for larger steps.",
    );

    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom", draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    markerRef.current = marker;
    // mapbox-gl stamps role="img" on marker elements, which would hide the
    // button semantics from assistive tech. Same fix as DealerMap.
    el.removeAttribute("role");

    marker.on("dragend", () => {
      const { lat: nextLat, lng: nextLng } = marker.getLngLat();
      emit(nextLat, nextLng);
    });

    // Tapping the map is far easier than a precise drag on a phone.
    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      emit(e.lngLat.lat, e.lngLat.lng);
    });

    el.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? NUDGE_SHIFT_M : NUDGE_M;
      let dLat = 0;
      let dLng = 0;
      switch (event.key) {
        case "ArrowUp": dLat = step; break;
        case "ArrowDown": dLat = -step; break;
        case "ArrowLeft": dLng = -step; break;
        case "ArrowRight": dLng = step; break;
        default: return;
      }
      // Stop mapbox's own keyboard handler from panning the map underneath us,
      // and stop the page from scrolling.
      event.preventDefault();
      event.stopPropagation();

      const current = marker.getLngLat();
      const metresPerDegLng =
        METRES_PER_DEG_LAT * Math.cos((current.lat * Math.PI) / 180);
      const nextLat = current.lat + dLat / METRES_PER_DEG_LAT;
      // Guard the poles, where cos(lat) collapses to 0. Irrelevant for
      // Australian addresses, but a division by ~0 would send the pin to NaN.
      const nextLng =
        Math.abs(metresPerDegLng) < 1
          ? current.lng
          : current.lng + dLng / metresPerDegLng;

      marker.setLngLat([nextLng, nextLat]);
      map.panTo([nextLng, nextLat], {
        duration: prefersReducedMotion() ? 0 : 120,
      });
      emit(nextLat, nextLng);
    });

    setMarkerEl(el);

    return () => {
      marker.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMarkerEl(null);
    };
    // lat/lng are the INITIAL camera position only. Re-running this on every
    // coordinate change would rebuild the whole map mid-drag; the sync effect
    // below handles subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken, emit]);

  // A runtime error (bad token, quota) leaves a half-built map mounted with
  // nowhere to render — tear it down so cleanup doesn't run twice on unmount.
  useEffect(() => {
    if (!mapError || !mapRef.current) return;
    markerRef.current?.remove();
    markerRef.current = null;
    mapRef.current.remove();
    mapRef.current = null;
  }, [mapError]);

  // ---- Follow externally-changed coordinates ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    // Our own emit already moved the marker. Re-centring here would yank the
    // camera away every time the dealer nudges the pin near the viewport edge.
    const emitted = emittedRef.current;
    if (emitted && emitted[0] === lat && emitted[1] === lng) return;
    marker.setLngLat([lng, lat]);
    map.easeTo({
      center: [lng, lat],
      zoom: DEFAULT_ZOOM,
      duration: prefersReducedMotion() ? 0 : 400,
    });
  }, [lat, lng]);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  if (mapError) {
    return (
      <MapFallback
        variant="error"
        caption="The map couldn't load. Your address above is still saved — we'll place your pin for you."
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-card" />

      {markerEl &&
        createPortal(
          <span className="relative block">
            <span className="relative flex h-[30px] w-[30px] rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] border-2 border-white bg-rust shadow-[0_4px_10px_rgba(22,39,28,.35)]">
              <span className="block h-[9px] w-[9px] rotate-45 rounded-full bg-white" />
            </span>
          </span>,
          markerEl,
        )}

      <div
        role="group"
        aria-label="Map zoom controls"
        className="absolute right-3.5 top-3.5 flex flex-col overflow-hidden rounded-[9px] bg-white shadow-[0_4px_14px_rgba(22,39,28,.18)]"
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={zoomIn}
          className="flex h-[38px] w-[38px] items-center justify-center border-b border-line text-[21px] text-green"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={zoomOut}
          className="flex h-[38px] w-[38px] items-center justify-center text-[21px] text-green"
        >
          −
        </button>
      </div>
    </div>
  );
}
