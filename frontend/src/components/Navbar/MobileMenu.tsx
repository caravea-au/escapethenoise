"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { StrapiLink } from "@/lib/strapi";

// Client island for the header on < md viewports: a hamburger toggle that opens
// a dropdown panel of the same nav links + CTA. Navbar stays a server component;
// only this interactive shell is client-side.
export function MobileMenu({
  menu,
  cta,
}: {
  menu: StrapiLink[];
  cta: StrapiLink | null;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="ml-auto md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sand transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-white/10 bg-green shadow-lg"
        >
          <nav className="flex flex-col gap-1 px-6 py-4">
            {menu.map((l) => (
              <Link
                key={l.label}
                href={l.url}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-3 text-base text-sand transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            {cta?.label && (
              <Button
                href={cta.url}
                fullWidth
                onClick={() => setOpen(false)}
                className="mt-2 rounded-[9px] text-sm"
              >
                {cta.label}
              </Button>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
