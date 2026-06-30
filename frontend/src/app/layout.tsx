import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { oswald, hankenGrotesk } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Find a Dealer | Caravan Industry Association of Australia",
    template: "%s | Find a Dealer",
  },
  description:
    "Find your nearest accredited caravan dealer. The official dealer directory of the Caravan Industry Association of Australia — no better time to escape the noise.",
  keywords: [
    "caravan dealer",
    "accredited dealer",
    "CIAA",
    "caravan directory",
    "escape the noise",
    "Australia",
  ],
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

const footerCols = [
  {
    heading: "Find a Dealer",
    links: ["Search dealers", "Near me", "Special offers", "Open now"],
  },
  {
    heading: "Resources",
    links: ["Buying guides", "Towing guide", "Events & shows", "Safety advice"],
  },
  {
    heading: "About CIAA",
    links: ["About us", "Accreditation", "For dealers", "Contact"],
  },
];

const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

const nav = [
  { label: "Find a Dealer", href: "/" },
  { label: "Browse by State", href: "/" },
  { label: "Buying Guides", href: "/" },
  { label: "Events", href: "/" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${hankenGrotesk.variable}`}
    >
      <body className="min-h-screen bg-cream text-ink">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-green">
          <div className="mx-auto flex h-[90px] max-w-[1280px] items-center gap-7 px-6">
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/brand/lockup-horizontal-reversed.svg"
                alt="No Better Time to Escape the Noise — Caravan Industry Association of Australia"
                width={220}
                height={64}
                priority
                className="block h-16 w-auto"
              />
            </Link>
            <nav className="ml-3.5 flex flex-wrap items-center gap-0.5">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-lg px-3.5 py-2 text-sm text-sand transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/"
              className="ml-auto shrink-0 whitespace-nowrap rounded-button bg-rust px-[19px] py-[11px] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(193,124,44,.35)] transition-colors hover:bg-rust-dark"
            >
              Visit a Dealer →
            </Link>
          </div>
        </header>

        <main>{children}</main>

        <footer className="bg-green text-sand">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-9 px-6 pb-[30px] pt-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div className="min-w-[200px]">
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/icon-white-reversed.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="shrink-0"
                />
                <div className="font-(family-name:--font-display) text-[19px] font-semibold uppercase tracking-[1px] text-white">
                  Find a Dealer
                </div>
              </div>
              <p className="mt-3.5 max-w-[280px] text-[13px] leading-[1.6] text-sand/80">
                The official dealer directory of the Caravan Industry
                Association of Australia.
              </p>
            </div>
            {footerCols.map((col) => (
              <div key={col.heading}>
                <div className="mb-3.5 font-(family-name:--font-display) text-sm font-semibold uppercase tracking-[1px] text-white">
                  {col.heading}
                </div>
                <div className="flex flex-col gap-[9px] text-[13.5px] text-sand/80">
                  {col.links.map((link) => (
                    <Link key={link} href="/" className="hover:text-white">
                      {link}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-[1280px] px-6">
            <div className="flex flex-wrap gap-3 border-t border-white/10 py-[18px] text-[12.5px] text-sand/80">
              <span className="font-semibold text-sand">Browse by state:</span>
              {states.map((state, i) => (
                <span key={state} className="flex gap-3">
                  {state}
                  {i < states.length - 1 && <span aria-hidden>·</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-[1280px] px-6">
            <div className="flex flex-wrap justify-between gap-3.5 border-t border-white/10 pb-1 pt-[18px] text-xs text-sand/60">
              <span>
                © 2026 Caravan Industry Association of Australia ·
                escapethenoise.com.au · 1300 555 000
              </span>
              <span className="flex gap-4">
                <Link href="/" className="hover:text-white">
                  Privacy
                </Link>
                <Link href="/" className="hover:text-white">
                  Terms
                </Link>
                <Link href="/" className="hover:text-white">
                  Accessibility
                </Link>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
