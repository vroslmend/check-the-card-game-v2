import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Check! The Card Game",
  description: "An online multiplayer card game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to set theme before page renders to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // On page load or when changing themes, best to add inline in \`head\` to avoid FOUC
            document.documentElement.classList.toggle(
              "dark",
              localStorage.theme === "dark" ||
                (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
            );
          })();
        ` }} />
      </head>
      <body className={`${plusJakartaSans.className} bg-neutral-100 dark:bg-neutral-900`}>
        {children}
      </body>
    </html>
  );
}
