"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Eye, Target } from "lucide-react"

interface CardBackProps {
  size?: "xs" | "sm" | "md" | "lg"
  layoutId?: string
  onClick?: () => void
  isSelected?: boolean
  isTarget?: boolean
  canInteract?: boolean
  isPeeked?: boolean
  position?: number
}

export function CardBack({
  size = "md",
  layoutId,
  onClick,
  isSelected = false,
  isTarget = false,
  canInteract = true,
  isPeeked = false,
  position,
}: CardBackProps) {
  const sizeClasses = {
    xs: "w-10 h-14",
    sm: "w-12 h-16",
    md: "w-16 h-24",
    lg: "w-20 h-28",
  }

  return (
    <div
      className={cn(
        "relative w-full h-full rounded-xl overflow-hidden shadow-md border",
        "border-emerald-700/40 text-emerald-50 dark:border-emerald-300/60 dark:text-emerald-900",
        sizeClasses[size]
      )}
    >
      {/* solid background always present */}
      <div className="absolute inset-0 z-0 bg-emerald-700 dark:bg-emerald-300" />

      {/* subtle noise overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-10 bg-[url('/noise.svg')] bg-repeat" />

      {/* minimal emblem */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div className={cn(
          "font-serif italic -rotate-12",
          "text-emerald-100/70 dark:text-emerald-800/60",
          size === 'xs' ? 'text-sm' : size === 'sm' ? 'text-base' : 'text-lg'
        )}>
          Check
        </div>
      </div>

      {/* Peek Indicator */}
      {isPeeked && (
        <motion.div
          className={cn(
            "absolute right-1 top-1 flex items-center justify-center rounded-full bg-blue-500 dark:bg-blue-600",
            size === 'xs' ? "h-3 w-3" : "h-4 w-4"
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Eye className={cn(size === 'xs' ? "h-1.5 w-1.5" : "h-2 w-2", "text-white")} />
        </motion.div>
      )}

      {/* Target Indicator */}
      {isTarget && (
        <motion.div
          className={cn(
            "absolute left-1 top-1 flex items-center justify-center rounded-full bg-amber-600 dark:bg-amber-500",
            size === 'xs' ? "h-3 w-3" : "h-4 w-4"
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Target className={cn(size === 'xs' ? "h-1.5 w-1.5" : "h-2 w-2", "text-white")} />
        </motion.div>
      )}

      {/* Position Number */}
      {position !== undefined && (
        <motion.div 
          className={cn(
            "absolute -bottom-1 -left-1 flex items-center justify-center rounded-full border border-stone-300 bg-stone-50 font-mono text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-400",
            size === 'xs' ? "h-3 w-3 text-[8px]" : "h-4 w-4 text-xs"
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {position}
        </motion.div>
      )}
    </div>
  )
} 