"use client";

import { cn } from "@/lib/utils";

export function CardBack() {
  return (
    <div
      className={cn(
        "relative w-full h-full rounded-md overflow-hidden shadow-md border",
        "bg-zinc-900 border-zinc-700",
      )}
    >
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03] bg-[url('/noise.svg')] bg-repeat" />

      <div
        className="absolute inset-0 z-0 opacity-80 dark:hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 40%)",
        }}
      />
    </div>
  );
}
