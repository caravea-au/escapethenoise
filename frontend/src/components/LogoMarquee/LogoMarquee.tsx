import Image from "next/image";

// Infinite horizontal logo marquee — two byte-identical tracks side by side so
// the `animate-marquee` keyframe (translateX 0 → -50%) loops seamlessly. The
// outer container (background, padding, rounding) belongs to the CALLER; this
// only owns the scrolling strip + the optional edge fades. Reused by TrustBar
// (state logos) and the vehicle detail page (Key Industry Partners). Logos may
// optionally link out via `href`.

export type MarqueeLogo = {
  src: string;
  alt: string;
  href?: string;
  width?: number;
  height?: number;
};

function Logo({ item, imageClassName, hidden }: { item: MarqueeLogo; imageClassName: string; hidden: boolean }) {
  const img = (
    <Image
      src={item.src}
      alt={hidden ? "" : item.alt}
      width={item.width ?? 140}
      height={item.height ?? 104}
      className={imageClassName}
    />
  );
  if (!item.href) return img;
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className="shrink-0"
    >
      {img}
    </a>
  );
}

function Track({
  items,
  gapClassName,
  imageClassName,
  hidden = false,
}: {
  items: MarqueeLogo[];
  gapClassName: string;
  imageClassName: string;
  hidden?: boolean;
}) {
  return (
    <div className={`flex items-center ${gapClassName} px-11`} aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <Logo key={`${it.src}-${i}`} item={it} imageClassName={imageClassName} hidden={hidden} />
      ))}
    </div>
  );
}

export function LogoMarquee({
  items,
  gapClassName = "gap-[88px]",
  imageClassName = "block h-[104px] w-auto shrink-0 object-contain",
  /** Hex the edge fades blend to (should match the caller's background). Omit for no fades. */
  fadeColor,
}: {
  items: MarqueeLogo[];
  gapClassName?: string;
  imageClassName?: string;
  fadeColor?: string;
}) {
  return (
    <div className="relative overflow-hidden">
      <div className="flex w-max animate-marquee">
        <Track items={items} gapClassName={gapClassName} imageClassName={imageClassName} />
        <Track items={items} gapClassName={gapClassName} imageClassName={imageClassName} hidden />
      </div>
      {fadeColor && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-0 w-[90px]"
            style={{ background: `linear-gradient(to right, ${fadeColor}, ${fadeColor}00)` }}
          />
          <div
            className="pointer-events-none absolute top-0 bottom-0 right-0 w-[90px]"
            style={{ background: `linear-gradient(to left, ${fadeColor}, ${fadeColor}00)` }}
          />
        </>
      )}
    </div>
  );
}
