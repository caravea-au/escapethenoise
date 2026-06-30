import { Oswald, Hanken_Grotesk } from "next/font/google";

// Display — Oswald (design.md §3): headings 600–700, uppercase hero/banners.
export const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Body — Hanken Grotesk (design.md §3): body 400–500, emphasis 600–800.
export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});
