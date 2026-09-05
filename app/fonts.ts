import localFont from "next/font/local";

// Self-hosted variable fonts (woff2 committed in app/fonts). Zero runtime network — §0.4.
export const bricolage = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin-wght-normal.woff2", style: "normal" },
    { path: "./fonts/bricolage-grotesque-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const instrument = localFont({
  src: [
    { path: "./fonts/instrument-sans-latin-wght-normal.woff2", style: "normal" },
    { path: "./fonts/instrument-sans-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  weight: "400 700",
  variable: "--font-instrument",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const jetbrains = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-wght-normal.woff2", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
});

export const fontClassNames = `${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`;
