import type { Metadata } from "next";
import { oswald, hanken, fraunces } from "@/lib/fonts";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Find a Dealer | Caravan Industry Association of Australia",
    template: "%s | Find a Dealer",
  },
  description:
    "Australia's most trusted caravan resource — search 403+ accredited dealers near you. The official dealer directory of the Caravan Industry Association of Australia.",
  keywords: [
    "caravan dealer",
    "accredited caravan dealer",
    "find a dealer",
    "caravan industry association of australia",
    "CIAA",
  ],
  // TODO: add real favicons to public/ then restore an `icons` block (export has favicon-*.png in uploads/).
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${oswald.variable} ${hanken.variable} ${fraunces.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
