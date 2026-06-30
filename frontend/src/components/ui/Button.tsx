import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-button px-[22px] py-[12px] text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(.2,.7,.2,1)] disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // design.md §6 — rust fill, white text, glow shadow; hover rust.dark + lift
  primary:
    "bg-rust text-white shadow-[0_4px_14px_rgba(193,124,44,.35)] hover:bg-rust-dark hover:-translate-y-0.5",
  // white fill, green text, 1.5px green border
  secondary:
    "bg-white text-green border-[1.5px] border-green hover:-translate-y-0.5",
};

type ButtonAsButton = {
  variant?: Variant;
  children: ReactNode;
  href?: undefined;
} & ComponentPropsWithoutRef<"button">;

type ButtonAsLink = {
  variant?: Variant;
  children: ReactNode;
  href: string;
} & ComponentPropsWithoutRef<"a">;

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", className = "", children, ...rest } = props;
  const cls = `${base} ${variants[variant]} ${className}`;

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as ComponentPropsWithoutRef<"a">)}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as ComponentPropsWithoutRef<"button">)}>
      {children}
    </button>
  );
}
