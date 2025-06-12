import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { CursorProvider } from '@/components/providers/CursorProvider';
import CustomCursor from '@/components/ui/CustomCursor';
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { UIMachineProvider } from '@/components/providers/UIMachineProvider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import 'lenis/dist/lenis.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: 'Check! - The Card Game',
  description: 'A card game of strategy, memory, and luck.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-serif antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <UIMachineProvider>
            <CursorProvider>
              <SmoothScrollProvider>
                {children}
                <CustomCursor />
              </SmoothScrollProvider>
              <Toaster />
            </CursorProvider>
          </UIMachineProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
