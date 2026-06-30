import type { Metadata } from "next";
import { goldman, workSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "[project-name] | Baseplate Starter",
    template: "%s | [project-name]",
  },
  description:
    "Minimal Next.js and Strapi baseplate for [project-name]. Replace the shell, metadata, and content structure with your project requirements.",
  keywords: [
    "[project-name]",
    "baseplate",
    "next.js",
    "strapi",
    "starter",
  ],
  icons: {
    icon: [
      {
        url: "/favicon-light.png",
        type: "image/png",
        sizes: "64x64",
      },
      {
        url: "/favicon-light.png",
        type: "image/png",
        sizes: "64x64",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png",
        type: "image/png",
        sizes: "64x64",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${goldman.variable} ${workSans.variable}`}>
      <body className="min-h-screen bg-surface-base text-brand-ink">
        <header className="border-b border-black/10 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <a
              href="/"
              className="font-(family-name:--font-display) text-xl uppercase tracking-[0.18em] text-brand-ink"
            >
              [project-name]
            </a>
            <nav className="hidden gap-6 text-sm font-semibold text-brand-ink/80 md:flex">
              <a href="/about" className="transition-colors hover:text-brand-primary">
                About
              </a>
              <a href="/services" className="transition-colors hover:text-brand-primary">
                Services
              </a>
              <a href="/contact" className="transition-colors hover:text-brand-primary">
                Contact
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-black/10 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
            <p>[project-name] baseplate</p>
            <p>Replace this shell before launch.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
