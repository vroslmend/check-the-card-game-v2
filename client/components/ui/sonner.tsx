"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, ToasterProps } from "sonner";
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
      toastOptions={{
        classNames: {
          // The table's own voice: surface card, hairline border, game
          // type. No glass blur (a Gecko repaint sink) and no hue-coded
          // borders — the identity reserves color for the one accent.
          toast: cn(
            "group rounded-card border border-hairline bg-surface shadow-lg",
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
