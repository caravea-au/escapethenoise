"use client";

// "Is this your entrance?" — the dealer confirms (or corrects) where their yard
// sits on the map, while filling in the onboarding form.
//
// Why this exists: coordinates used to be derived later, in bulk, by geocoding
// the typed address offline. That put a dealer on their postcode's centroid (or
// nowhere) until someone ran a script and shipped a deploy, and nobody could
// correct a wrong pin without a code change. The dealer knows their own driveway
// better than any geocoder, so we ask them once, here.
//
// Deliberately OPTIONAL. This form is long, is how dealers join, and has a
// history of silent failures — it does not get another required interaction.
// The pin is pre-filled by the server so most dealers never touch it, and
// `source` records whether they did.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapFallback } from "@/components/DealerDirectory/MapFallback";
import { centroidFor, haversineKm } from "@/lib/dealers";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

// Long enough that typing an address doesn't fire a request per keystroke,
// short enough that the map appears while the dealer is still looking at the
// address block rather than after they've scrolled past it.
const DEBOUNCE_MS = 800;

// Nominatim calls are serialised server-side at ~1/sec and may queue behind
// other dealers, so this is deliberately generous.
const LOOKUP_TIMEOUT_MS = 15_000;

// How far a pin can sit from the centroid of the postcode the dealer typed
// before we ask them to double-check. Australian postcodes get large in the
// bush, so this is a nudge, never a blocker — and the server applies its own
// authoritative version of this check.
const FAR_FROM_POSTCODE_KM = 25;

// mapbox-gl v3 is ~499KB gzipped (measured) and this route never loaded it
// before. Gated on a resolved pin below, so a dealer who abandons the form early
// never fetches it, and it shares one chunk with /find-dealer's DealerMap.
const PinMap = dynamic(() => import("./PinMap").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <MapFallback variant="loading" caption="Loading map…" />,
});

export type DealerPin = {
  lat: number;
  lng: number;
  precision: "street" | "approx";
  /** `geocoded` = never touched the map. `adjusted` = moved the pin themselves. */
  source: "geocoded" | "adjusted";
  matchedAddress: string;
  geocodedAddress: string;
};

type Status = "idle" | "locating" | "ready" | "notfound" | "busy";

/**
 * Accepts the geocode response only if it is actually shaped like a pin. A
 * `200 {"data":{}}` from any intermediary would otherwise reach render and throw
 * on `pin.lat.toFixed(5)`, taking the whole form island down — which is the
 * exact silent-failure class this form has history with.
 */
function asPin(value: unknown): Omit<DealerPin, "source"> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.lat !== "number" || !Number.isFinite(v.lat)) return null;
  if (typeof v.lng !== "number" || !Number.isFinite(v.lng)) return null;
  const precision = v.precision === "street" ? "street" : "approx";
  return {
    lat: v.lat,
    lng: v.lng,
    precision,
    matchedAddress: typeof v.matchedAddress === "string" ? v.matchedAddress : "",
    geocodedAddress:
      typeof v.geocodedAddress === "string" ? v.geocodedAddress : "",
  };
}

type Props = {
  /** Id for the field group, so the Field label has a real element to point at. */
  id: string;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  mapboxToken: string | null;
  pin: DealerPin | null;
  onChange: (pin: DealerPin | null) => void;
};

export function LocationPin({
  id,
  street,
  suburb,
  state,
  postcode,
  mapboxToken,
  pin,
  onChange,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");

  // Identity of the last address we looked up, so re-blurring an unchanged
  // address (or an unrelated field changing) never re-queries.
  const lastQueriedRef = useRef<string | null>(null);
  // Monotonic request id: a slow reply for an address the dealer has since
  // edited must not overwrite a newer result.
  const reqIdRef = useRef(0);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Only look up once the address block is genuinely complete. The 4-digit
  // postcode test is what stops "20", "205", "2056" being three lookups.
  const addressComplete =
    street.trim().length > 2 &&
    suburb.trim().length > 1 &&
    state.trim().length > 0 &&
    /^\d{4}$/.test(postcode.trim());

  const addressKey = addressComplete
    ? [street.trim(), suburb.trim(), state.trim(), postcode.trim()].join("|")
    : "";

  useEffect(() => {
    if (!addressKey) return;
    if (lastQueriedRef.current === addressKey) return;

    const timer = setTimeout(() => {
      lastQueriedRef.current = addressKey;
      const reqId = ++reqIdRef.current;
      setStatus("locating");

      void (async () => {
        try {
          const res = await fetch(`${STRAPI_URL}/api/geocode-address`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ street, suburb, state, postcode }),
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
          });
          if (reqId !== reqIdRef.current) return;
          // 429 is load shedding, NOT a bad address. Telling a dealer we
          // couldn't find their address when the real answer is "we're busy"
          // sends them off editing a perfectly correct address.
          if (res.status === 429) {
            setStatus("busy");
            onChangeRef.current(null);
            return;
          }
          if (!res.ok) {
            setStatus("notfound");
            onChangeRef.current(null);
            return;
          }
          const body = (await res.json()) as { data?: unknown };
          if (reqId !== reqIdRef.current) return;
          const resolved = asPin(body?.data);
          if (!resolved) {
            setStatus("notfound");
            onChangeRef.current(null);
            return;
          }
          setStatus("ready");
          onChangeRef.current({ ...resolved, source: "geocoded" });
        } catch {
          if (reqId !== reqIdRef.current) return;
          // Timeout or offline. Never surfaced as a form error: the dealer can
          // still submit, and the team can place the pin later.
          setStatus("notfound");
          onChangeRef.current(null);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `street`/`suburb`/`state`/`postcode` are folded into addressKey; listing
    // them too would re-arm the debounce on whitespace-only edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey]);

  const handlePinMove = useCallback(
    (lat: number, lng: number) => {
      onChangeRef.current(
        pin
          ? // A dealer placing their own pin is the best source we have, so it
            // counts as street-level regardless of what the geocoder returned.
            { ...pin, lat, lng, precision: "street", source: "adjusted" }
          : null,
      );
    },
    [pin],
  );

  // Sanity check against the postcode they typed. Uses the same centroid data
  // and haversine the directory uses, so the warning can never disagree with
  // the distances shown on /find-dealer.
  const centroid = centroidFor(postcode);
  const kmFromPostcode =
    pin && centroid ? haversineKm([pin.lat, pin.lng], centroid) : null;
  const farFromPostcode =
    kmFromPostcode !== null && kmFromPostcode > FAR_FROM_POSTCODE_KM;

  // Always render the group with `id`, in every state, so the Field's
  // `htmlFor`/`aria-labelledby` always has a real element to point at. The map
  // is not a labelable control, so the field is labelled as a group instead.
  const groupProps = {
    id,
    role: "group" as const,
    "aria-labelledby": `${id}-label`,
  };

  if (!addressComplete && !pin) {
    return (
      <div {...groupProps}>
        <p className="text-[12.5px] text-muted">
          Fill in your address above and we&apos;ll show you a map to check your pin.
        </p>
      </div>
    );
  }

  return (
    <div {...groupProps} className="flex flex-col gap-[10px]">
      {/* Status for assistive tech. The visible copy below carries the same
          information, so this stays polite rather than assertive. The
          far-from-postcode warning is included here too: it appears instantly
          for a sighted user, so it must be announced rather than only drawn. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === "locating"
          ? "Finding your address on the map."
          : status === "busy"
            ? "The map service is busy. You can still submit the form and we'll place your pin for you."
            : status === "ready" && pin
              ? `Pin placed at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.` +
                (farFromPostcode
                  ? ` Warning: that is about ${Math.round(kmFromPostcode as number)} kilometres from postcode ${postcode.trim()}. Please check it is in the right place.`
                  : "")
              : status === "notfound"
                ? "We couldn't place your address on the map. You can still submit the form."
                : ""}
      </p>

      <div className="h-[280px] w-full sm:h-[320px]">
        {status === "locating" && !pin ? (
          <MapFallback variant="loading" caption="Finding your address…" />
        ) : status === "busy" && !pin ? (
          <MapFallback
            variant="unavailable"
            caption="The map is busy right now — nothing wrong with your address. Carry on and we'll place your pin for you."
          />
        ) : status === "notfound" && !pin ? (
          <MapFallback
            variant="unavailable"
            caption="We couldn't find that address on the map. Double-check it above, or just carry on — we'll place your pin for you."
          />
        ) : !pin ? (
          <MapFallback variant="loading" caption="Loading map…" />
        ) : !mapboxToken ? (
          <MapFallback
            variant="unavailable"
            caption="Map unavailable right now. Your address is saved and we'll place your pin for you."
          />
        ) : (
          <PinMap
            mapboxToken={mapboxToken}
            lat={pin.lat}
            lng={pin.lng}
            onChange={handlePinMove}
          />
        )}
      </div>

      {pin && (
        <>
          <p className="text-[12.5px] text-muted">
            {pin.source === "adjusted"
              ? "Thanks — we'll use this spot."
              : pin.precision === "street"
                ? "Drag the pin (or tap the map) if your entrance is somewhere else."
                : "We could only place this approximately. Please drag the pin to your entrance."}{" "}
            {/* Visible, not only in the marker's aria-label: a sighted keyboard
                user has no screen reader to read that out, and would otherwise
                see a pin with no hint that it can be moved without a mouse.
                Avoids the word "focus", which means nothing to a dealer. */}
            Or click the pin, then nudge it with your arrow keys.{" "}
            <span className="text-green">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </span>
          </p>

          {farFromPostcode && (
            <p className="text-[12.5px] font-medium text-error">
              That pin is about {Math.round(kmFromPostcode as number)}km from postcode{" "}
              {postcode.trim()}. Please check it&apos;s in the right place.
            </p>
          )}

          {/* ODbL: the coordinates and the base map both need crediting wherever
              they are shown. Do not remove — see the licence note in lib/dealers.ts. */}
          <p className="text-[11px] text-muted">
            Map data © OpenStreetMap contributors · © Mapbox
          </p>
        </>
      )}
    </div>
  );
}
