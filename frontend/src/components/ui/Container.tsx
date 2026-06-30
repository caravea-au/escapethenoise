import type { ComponentPropsWithoutRef, ReactNode } from "react";

// design.md §5 — max content width: 1280 (marketing) / 1180 (education, events)
// / 820 (article). Gutters 24px (px-6).
type Width = "marketing" | "content" | "article";

const widths: Record<Width, string> = {
  marketing: "max-w-[1280px]",
  content: "max-w-[1180px]",
  article: "max-w-[820px]",
};

export function Container({
  width = "marketing",
  className = "",
  children,
  ...rest
}: { width?: Width; children: ReactNode } & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={`mx-auto w-full px-6 ${widths[width]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
