import type { ComponentPropsWithoutRef } from "react";
import NextLink from "next/link";

// Inline text link — rust accent (design.md §2: rust drives links/action).
export function Link({
  href,
  className = "",
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof NextLink>) {
  return (
    <NextLink
      href={href}
      className={`text-rust underline-offset-2 transition-colors hover:text-rust-dark hover:underline ${className}`}
      {...rest}
    >
      {children}
    </NextLink>
  );
}
