import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

// Infinite logo/content marquee. CSS-only (uses the `animate-marquee` theme keyframe),
// so it runs even without client JS, and pauses on hover. The children are duplicated
// once for a seamless -50% loop; reduced-motion is honoured via globals.css.
export function Marquee({ children, className }: Props) {
  return (
    <div className={`group relative overflow-hidden ${className ?? ""}`}>
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
