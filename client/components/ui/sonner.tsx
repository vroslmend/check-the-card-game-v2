"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: cn(
            "group border border-white/20 dark:border-white/10",
            "bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl",
            "rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_15px_rgba(0,0,0,0.2)]",
            "text-stone-800 dark:text-stone-200 font-serif",
            "relative overflow-hidden",
          ),
          title: "text-stone-800 dark:text-stone-200 font-medium",
          description: "text-stone-600 dark:text-stone-400 font-light",
          actionButton:
            "bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 backdrop-blur-md",
          cancelButton:
            "bg-stone-200/50 dark:bg-zinc-800/50 text-stone-600 dark:text-stone-400 backdrop-blur-md",
          success:
            "border-l-4 border-l-emerald-500 before:absolute before:inset-0 before:bg-emerald-500/5 before:-z-10",
          error:
            "border-l-4 border-l-red-500 before:absolute before:inset-0 before:bg-red-500/5 before:-z-10",
          warning:
            "border-l-4 border-l-amber-500 before:absolute before:inset-0 before:bg-amber-500/5 before:-z-10",
          info: "border-l-4 border-l-stone-500 dark:border-l-stone-400 before:absolute before:inset-0 before:bg-stone-500/5 before:-z-10",
          loading:
            "border-l-4 border-l-stone-300 dark:border-l-stone-600 before:absolute before:inset-0 before:bg-stone-500/5 before:-z-10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
