"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Eye, Target } from "lucide-react"

interface CardBackProps {
  size?: "sm" | "md" | "lg"
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
    sm: "w-12 h-16",
    md: "w-16 h-24",
    lg: "w-20 h-28",
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 h-full w-full",
        sizeClasses[size],
        isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/10 dark:border-blue-400 dark:shadow-blue-400/10"
          : isTarget
          ? "border-amber-500 shadow-lg shadow-amber-500/10 dark:border-amber-400 dark:shadow-amber-400/10"
          : isPeeked
          ? "border-green-500 shadow-lg shadow-green-500/10 dark:border-green-400 dark:shadow-green-400/10"
          : "border-stone-200 dark:border-zinc-800",
        !canInteract && "cursor-not-allowed opacity-60"
      )}
    >
      {/* Card Pattern Background */}
      <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-white to-stone-100 dark:from-zinc-900 dark:to-zinc-950">
        {/* Diamond pattern */}
        <motion.div 
          className="absolute inset-0 opacity-10"
          initial={{ backgroundPosition: "0% 0%" }}
          animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              currentColor 0,
              currentColor 1px,
              transparent 0,
              transparent 10px
            )`
          }}
        />

        {/* Center emblem */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            className="w-12 h-12 flex items-center justify-center"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-lg font-serif italic text-stone-600/50 dark:text-stone-400/50 transform -rotate-12">
              Check
            </div>
          </motion.div>
        </div>
      </div>

      {/* Peek Indicator */}
      {isPeeked && (
        <motion.div
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 dark:bg-blue-400"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Eye className="h-2 w-2 text-white" />
        </motion.div>
      )}

      {/* Target Indicator */}
      {isTarget && (
        <motion.div
          className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 dark:bg-amber-400"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Target className="h-2 w-2 text-white" />
        </motion.div>
      )}

      {/* Position Number */}
      {position !== undefined && (
        <motion.div 
          className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-stone-300 bg-stone-50 font-mono text-xs text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-400"
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