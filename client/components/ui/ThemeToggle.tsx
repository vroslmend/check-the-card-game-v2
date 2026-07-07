"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { play } from "@/lib/sounds";

/** Quiet icon chip in the header idiom: hairline surface button, the glyph
 *  rolls over on switch. Uses resolvedTheme so a system preference reads
 *  correctly; renders a blank glyph slot until mounted (no hydration flash). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => {
        play("click");
        setTheme(isDark ? "light" : "dark");
      }}
      className="flex h-9 w-9 min-w-[36px] items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={
        mounted
          ? isDark
            ? "Switch to light theme"
            : "Switch to dark theme"
          : "Toggle theme"
      }
    >
      {mounted ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={isDark ? "sun" : "moon"}
            initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
