"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { label: "Find a Dealer", href: "#" },
  { label: "Browse by State", href: "#" },
  { label: "Buying Guides", href: "#" },
  { label: "Events", href: "#" },
];

// Tier-2 — global header (design.md §4). Inline nav on desktop, a disclosure
// menu under the bar on < lg so links never collide with the logo/CTA.
export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-green">
      <Container className="flex h-[90px] items-center gap-7">
        <Link href="/" onClick={close} className="flex shrink-0 items-center">
          <Image
            src="/brand/lockup-horizontal-reversed.svg"
            alt="No Better Time to Escape the Noise — Caravan Industry Association of Australia"
            width={210}
            height={64}
            className="h-12 w-auto sm:h-16"
            priority
          />
        </Link>

        {/* desktop nav */}
        <nav className="ml-3.5 hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm text-sand transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden shrink-0 lg:block">
          <Button href="#" className="whitespace-nowrap rounded-[9px] px-[19px] py-[11px] text-sm">
            Visit a Dealer →
          </Button>
        </div>

        {/* mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-sand transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </Container>

      {/* mobile menu */}
      {open && (
        <div id="mobile-menu" className="border-t border-white/10 bg-green lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-[15px] text-sand transition-colors hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Button href="#" onClick={close} fullWidth className="mt-2 rounded-[9px] py-3 text-sm">
              Visit a Dealer →
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
