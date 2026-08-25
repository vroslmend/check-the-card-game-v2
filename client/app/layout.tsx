import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { Providers } from "./providers";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "lenis/dist/lenis.css";

// The one type family, app-wide (exposed as --font-game). The landing page
// joined the game's identity in Round 11; Playfair/Inter are retired.
const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  // Every relative URL below, and the generated opengraph-image, resolves
  // against this. Without it Next falls back to VERCEL_URL or localhost, so
  // the share card points somewhere nobody can reach.
  metadataBase: new URL(SITE_URL),
  // Inherited by any route that sets no title of its own, which is why
  // app/game/layout.tsx sets one: a room tab must not read this sentence.
  title: "Check! - free online card game to play with friends",
  description: SITE_DESCRIPTION,
  // Proves ownership of the Search Console property. A public tag rather than
  // a secret, and it has to stay: Google re-checks, so a property that loses
  // its tag goes unverified again.
  verification: { google: "w0uP0kvKNvORgtpbYZQ8UDucoJr4CDUfi0XLACdzaR0" },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Check!",
    description: "Play online with friends, in real time.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// themeColor tints the OS chrome around an installed window and the browser
// UI on mobile. Static and dark rather than a prefers-color-scheme pair,
// because providers.tsx sets defaultTheme="dark": a visitor whose system is
// light still sees the dark app unless they change it, so a light tint would
// frame a dark board.
export const viewport: Viewport = {
  themeColor: "#121212",
};

// A script tag because Next has no metadata field for JSON-LD.
const gameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Check!",
  // Trailing slash, so this agrees with the canonical and the sitemap entry.
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  genre: "Card game",
  gamePlatform: "Web browser",
  applicationCategory: "GameApplication",
  operatingSystem: "Any",
  playMode: "MultiPlayer",
  numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 6 },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  isAccessibleForFree: true,
  inLanguage: "en",
};

// Escaped and serialised once. A raw "<" in any field, most plausibly a future
// edit to SITE_DESCRIPTION, would close the script element early.
const gameSchemaJson = JSON.stringify(gameSchema).replace(/</g, "\\u003c");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={nunito.variable}>
      <body className="font-game antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: gameSchemaJson }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
