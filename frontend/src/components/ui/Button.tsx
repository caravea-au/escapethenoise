import type { ReactNode } from "react";
import Link from "next/link";

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
} as const;

type Props = {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  href?: string;
  className?: string;
  fullWidth?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
};

// design.md §6 — primary CTA + variants. Renders a Link when `href` is set, else a <button>.
export function Button({
  children,
  variant = "primary",
  href,
  className = "",
  fullWidth = false,
  ...rest
}: Props) {
  const base = `inline-flex items-center justify-center gap-2 font-semibold rounded-button px-6 py-3 text-base transition-all duration-200 cursor-pointer ${
    fullWidth ? "w-full" : ""
  } ${VARIANTS[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={base} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={base} {...rest}>
      {children}
    </button>
  );
}
