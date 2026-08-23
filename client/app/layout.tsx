import "./globals.css";
import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { Providers } from "./providers";
import { SITE_URL } from "@/lib/site";
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
  title: "Check! - The Card Game",
  description: "A card game of strategy, memory, and luck.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={nunito.variable}>
      <body className="font-game antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
