// Zoom in/out stack for a Mapbox map, positioned over the map's top-right.
//
// Extracted when a second map needed it (the onboarding form's location pin,
// alongside /find-dealer's dealer map) rather than being built speculatively —
// the two copies were byte-identical, so the next change would have had to be
// made twice or would have silently diverged.
//
// Deliberately NOT mapbox's own NavigationControl: that ships a compass and
// mapbox's own button styling, and neither map wants either.

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapZoomControls({ onZoomIn, onZoomOut }: Props) {
  return (
    <div
      role="group"
      aria-label="Map zoom controls"
      className="absolute right-3.5 top-3.5 flex flex-col overflow-hidden rounded-[9px] bg-white shadow-[0_4px_14px_rgba(22,39,28,.18)]"
    >
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="flex h-[38px] w-[38px] items-center justify-center border-b border-line text-[21px] text-green"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="flex h-[38px] w-[38px] items-center justify-center text-[21px] text-green"
      >
        −
      </button>
    </div>
  );
}
