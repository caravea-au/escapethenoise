import type { ComponentPropsWithoutRef, ReactNode } from "react";

const VARIANTS = {
  // design.md §6 — rust fill, white text, glow + hover lift
  primary:
    "bg-rust hover:bg-rust-dark text-white shadow-[0_10px_24px_-6px_rgba(193,124,44,.5)] hover:-translate-y-0.5",
  // white fill, green text, hairline border
  secondary: "bg-white text-green border-[1.5px] border-[#c9bda0] hover:border-green",
  // green outline on white
  outline: "bg-white text-green border-[1.5px] border-green",
  // translucent glass for dark/photo backgrounds
  glass:
    "bg-white/[.06] hover:bg-white/[.15] text-white border border-white/20 hover:border-white/40 backdrop-blur-[6px]",
  // solid green fill (article footer / dealer-conversion CTA)
  tertiary: "bg-green hover:bg-green-dark text-white hover:-translate-y-0.5",
} as const;

type Variant = keyof typeof VARIANTS;

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-button px-6 py-3 text-base transition-all duration-200 cursor-pointer";

type ButtonAsButton = {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
  href?: undefined;
} & ComponentPropsWithoutRef<"button">;

type ButtonAsLink = {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
  href: string;
} & ComponentPropsWithoutRef<"a">;

// design.md §6 — primary CTA + variants. Renders an <a> when `href` is set, else a <button>.
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    fullWidth = false,
    className = "",
    children,
    ...rest
  } = props;
  const cls = `${base} ${fullWidth ? "w-full" : ""} ${VARIANTS[variant]} ${className}`;

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as ComponentPropsWithoutRef<"a">)}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      {...(rest as ComponentPropsWithoutRef<"button">)}
    >
      {children}
    </button>
  );
}
