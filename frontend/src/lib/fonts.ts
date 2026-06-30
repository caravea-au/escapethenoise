import { Oswald, Hanken_Grotesk } from "next/font/google";

// Display — Oswald (headings, stats, eyebrows). Body — Hanken Grotesk.
// Variable names (--font-display / --font-body) are the contract used by
// tokens.css (@theme) and globals.css; keep them stable.
export const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});
