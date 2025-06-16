"use client"

import { cn } from "@/lib/utils"

export function CardBack() {
  return (
    <div
      className={cn(
        "relative w-full h-full rounded-md overflow-hidden shadow-md border",
        // Light theme: dark back. Dark theme: slightly lighter dark back.
        "bg-zinc-900 border-zinc-800 dark:bg-zinc-800 dark:border-zinc-700"
      )}
    >
      {/* subtle noise overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03] bg-[url('/noise.svg')] bg-repeat" />

      {/* A very subtle sheen/gradient to give a slight texture, ONLY in light mode */}
      <div 
        className="absolute inset-0 z-0 opacity-80 dark:hidden"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 40%)'
        }}
      />
    </div>
  )
} 