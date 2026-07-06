import "./globals.css";
import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { Providers } from "./providers";
import { cn } from "@/lib/utils";
import "lenis/dist/lenis.css";

// The one type family, app-wide (exposed as --font-game). The landing page
// joined the game's identity in Round 11; Playfair/Inter are retired.
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
      className={nunito.variable}
    >
      <body className="font-game antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
