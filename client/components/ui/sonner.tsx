"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, ToasterProps } from "sonner";
import { AlertTriangle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Game events are table announcements, and the table's language is
      // centered (header, piles, prompt, stamps) — not OS-notification
      // top-right. The offset clears the game header.
      position="top-center"
      offset={64}
      gap={8}
      visibleToasts={3}
      className="toaster group"
      icons={{
        error: <AlertTriangle className="h-4 w-4 text-accent" />,
        warning: <AlertTriangle className="h-4 w-4 text-accent" />,
        info: <Info className="h-4 w-4 text-ink-muted" />,
        success: <Check className="h-4 w-4 text-ink" />,
      }}
      toastOptions={{
        classNames: {
          // The table's own voice: surface pill, hairline border, game type.
          // The one hue is the accent on the error glyph; text stays ink.
          toast: cn(
            "group rounded-2xl border border-hairline bg-surface shadow-lg",
            "px-4 py-3 font-game text-sm font-semibold text-ink",
          ),
          title: "text-ink font-semibold",
          description: "text-ink-muted font-medium",
          actionButton: "bg-accent text-accent-ink",
          cancelButton: "bg-surface-2 text-ink-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
