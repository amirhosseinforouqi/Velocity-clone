import { Fraunces, Instrument_Sans } from "next/font/google";

// Client portal type: a warm serif for headings, a plain sans for everything else.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });
export const portalFonts = `${display.variable} ${body.variable} font-[family-name:var(--font-body)]`;
