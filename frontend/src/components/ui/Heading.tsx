import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Display type — Oswald (design.md §3). Sizes are fixed breakpoint steps
// converted from the design's clamp() roles (NO clamp — iOS/Safari):
//   hero    clamp(40,6.6vw,78) → 40 / md 51 / lg 68 / xl 78
//   section clamp(26,4vw,44)   → 26 / md 31 / lg 41 / xl 44
//   stat    clamp(54,7vw,82)   → 54 / lg 72 / xl 82
//   card    18–19px
type Size = "hero" | "section" | "stat" | "card";

const sizes: Record<Size, string> = {
  hero: "text-[40px] md:text-[51px] lg:text-[68px] xl:text-[78px] font-bold uppercase leading-[0.95] tracking-[-1.7px]",
  section:
    "text-[26px] md:text-[31px] lg:text-[41px] xl:text-[44px] font-bold leading-[1.05] tracking-[-0.5px]",
  stat: "text-[54px] lg:text-[72px] xl:text-[82px] font-bold uppercase leading-none tracking-[-1px]",
  card: "text-[19px] font-bold leading-tight",
};

type HeadingTag = "h1" | "h2" | "h3" | "h4";

export function Heading({
  as: Tag = "h2",
  size = "section",
  className = "",
  children,
  ...rest
}: {
  as?: HeadingTag;
  size?: Size;
  children: ReactNode;
} & ComponentPropsWithoutRef<"h2">) {
  return (
    <Tag
      className={`font-(family-name:--font-display) ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
