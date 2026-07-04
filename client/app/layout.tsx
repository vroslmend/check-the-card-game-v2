import "./globals.css";
import type { Metadata } from "next";
import { Playfair_Display, Inter, Nunito_Sans } from "next/font/google";
import { Providers } from "./providers";
import { cn } from "@/lib/utils";
import "lenis/dist/lenis.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// The game's one type family (exposed as --font-game). Playfair/Inter remain
// for the landing page; game views use Nunito Sans.
const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Check! - The Card Game",
  description: "A card game of strategy, memory, and luck.",
  openGraph: {
    title: "Check!",
    description: "Play online with friends, in real time.",
    url: "https://check-the-game.vercel.app",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${playfair.variable} ${inter.variable} ${nunito.variable}`}
    >
      <body className="font-serif antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
