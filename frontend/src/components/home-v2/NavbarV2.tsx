"use client";

import { useState } from "react";
import { useLenis } from "lenis/react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { label: "Find a Dealer", href: "#" },
  { label: "Buying Guides", href: "#" },
  { label: "Events", href: "#" },
];

// Bespoke editorial nav for /v2 — transparent over the dark video hero, turns to a solid
// cream bar once you scroll past it (with a full-colour logo swap). Minimal, restrained.
export function NavbarV2() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  // Subscribe to Lenis's own scroll value (the actual scroll driver on this page) —
  // reliable, unlike window scroll events / Motion's useScroll which Lenis bypasses.
  useLenis((lenis) => setSolid(lenis.scroll > 72));

  const onDark = !solid && !open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open ? "border-b border-line bg-cream/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center px-6">
        <Link href="/v2" onClick={() => setOpen(false)} className="flex shrink-0 items-center">
          <Image
            src={onDark ? "/brand/lockup-horizontal-reversed.svg" : "/brand/lockup-horizontal-fullcolour.svg"}
            alt="Find a Dealer — Caravan Industry Association of Australia"
            width={180}
            height={52}
            className="h-11 w-auto"
            priority
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`text-[13px] font-semibold uppercase tracking-[1.5px] transition-colors ${
                onDark ? "text-white/85 hover:text-white" : "text-green hover:text-rust"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Button href="#" className="px-5 py-2.5 text-[13px]">
            Find a dealer →
          </Button>
        </nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="v2-menu"
          onClick={() => setOpen((v) => !v)}
          className={`ml-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors md:hidden ${
            onDark ? "text-white hover:bg-white/10" : "text-green hover:bg-green/10"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div id="v2-menu" className="border-t border-line bg-cream md:hidden">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-6 py-4">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-[15px] font-semibold uppercase tracking-[1px] text-green transition-colors hover:bg-green/5 hover:text-rust"
              >
                {l.label}
              </Link>
            ))}
            <Button href="#" onClick={() => setOpen(false)} fullWidth className="mt-2 py-3 text-sm">
              Find a dealer →
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
