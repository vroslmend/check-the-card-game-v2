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
        "relative w-full h-full rounded-xl border border-stone-200/50 dark:border-zinc-600 bg-white dark:bg-zinc-300 shadow-md",
        sizeClasses[size]
      )}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div 
          className="absolute inset-1.5 rounded-lg border border-dashed border-stone-300 dark:border-zinc-600 flex items-center justify-center"
        >
          <div className="w-4 h-4 rounded-full bg-stone-200 dark:bg-zinc-500" />
        </div>
      </div>

      {/* Card Pattern Background */}
      <div className="absolute inset-0 overflow-hidden rounded-xl bg-gradient-to-br from-white to-stone-100 dark:from-zinc-300 dark:to-zinc-600">
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
            className={cn(
              "flex items-center justify-center",
              size === 'xs' ? "w-8 h-8" : size === 'sm' ? "w-10 h-10" : "w-12 h-12"
            )}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className={cn(
              "font-serif italic text-stone-600/50 dark:text-stone-400 transform -rotate-12",
              size === 'xs' ? "text-sm" : size === 'sm' ? "text-base" : "text-lg"
            )}>
              Check
            </div>
          </motion.div>
        </div>
      </div>

      {/* Peek Indicator */}
      {isPeeked && (
        <motion.div
          className={cn(
            "absolute right-1 top-1 flex items-center justify-center rounded-full bg-blue-500 dark:bg-blue-400",
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
            "absolute left-1 top-1 flex items-center justify-center rounded-full bg-amber-500 dark:bg-amber-400",
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