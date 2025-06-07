import type { Metadata } from "next";
import "@/app/globals.css";
import { UIMachineProvider } from "@/machines/uiMachineProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UIMachineProvider>{children}</UIMachineProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
