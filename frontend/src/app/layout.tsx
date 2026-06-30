import type { Metadata } from "next";
import { oswald, hanken } from "@/lib/fonts";
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
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${oswald.variable} ${hanken.variable}`}>
      <body className="flex min-h-svh flex-col">{children}</body>
    </html>
  );
}
