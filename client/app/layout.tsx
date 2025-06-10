import type { Metadata } from "next";
import "@/app/globals.css";
import 'lenis/dist/lenis.css'
import { ThemeProvider } from "next-themes";
import { Playfair_Display, Inter } from "next/font/google";
import CustomCursor from '@/components/ui/CustomCursor';
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Toaster } from "@/components/ui/sonner"
import { CursorProvider } from "@/components/providers/CursorProvider";
import { SocketConnectionProvider } from "@/components/providers/SocketConnectionProvider";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Check! - The Card Game",
  description: "A card game of strategy, memory, and luck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-serif antialiased no-cursor">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <SocketConnectionProvider>
            <CursorProvider>
              <SmoothScrollProvider>
                {children}
              </SmoothScrollProvider>
              <CustomCursor />
            </CursorProvider>
          </SocketConnectionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
