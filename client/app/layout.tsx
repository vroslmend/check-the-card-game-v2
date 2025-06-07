import type { Metadata } from "next";
import "@/app/globals.css";
import { UIMachineProvider } from "@/machines/uiMachineProvider";
import { ThemeProvider } from "next-themes";
import { Playfair_Display, Inter } from "next/font/google";
import CustomCursor from '@/components/ui/CustomCursor';

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
  title: "Check!",
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
          <UIMachineProvider>{children}</UIMachineProvider>
          <CustomCursor />
        </ThemeProvider>
      </body>
    </html>
  );
}
