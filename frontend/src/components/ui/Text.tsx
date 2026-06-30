import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Body type — Hanken Grotesk (design.md §3). Variants cover the body and
// eyebrow/label roles; the family is the global default, so no font class.
type Variant = "body" | "lead" | "eyebrow" | "meta";

const variants: Record<Variant, string> = {
  body: "text-[15px] lg:text-[17px] leading-[1.6]",
  lead: "text-[17px] lg:text-[19px] leading-[1.6]",
  // eyebrow: 11–12px, 600/700, uppercase, tracking 2–3px
  eyebrow: "text-[11px] lg:text-[12px] font-semibold uppercase tracking-[2px]",
  meta: "text-[13px] text-muted leading-[1.5]",
};

export function Text({
  as: Tag = "p",
  variant = "body",
  className = "",
  children,
  ...rest
}: {
  as?: "p" | "span" | "div";
  variant?: Variant;
  children: ReactNode;
} & ComponentPropsWithoutRef<"p">) {
  return (
    <Tag className={`${variants[variant]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
