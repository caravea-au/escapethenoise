import { Oswald, Hanken_Grotesk, Fraunces } from "next/font/google";

// Display — Oswald (headings, stats, eyebrows). Body — Hanken Grotesk.
// Serif accent — Fraunces (used sparingly, italic, for editorial leads/pull-quotes).
// Variable names (--font-display / --font-body / --font-serif) are the contract used
// by tokens.css (@theme) and globals.css; keep them stable.
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
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
