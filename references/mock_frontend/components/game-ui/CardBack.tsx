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
    <motion.div
      layoutId={layoutId}
      className={cn(
        "relative cursor-pointer rounded-lg border-2 bg-gradient-to-br from-stone-100 to-stone-200/60 transition-all duration-200 dark:from-stone-800 dark:to-stone-900/60",
        sizeClasses[size],
        isSelected &&
          "border-stone-900 shadow-lg shadow-stone-900/10 ring-2 ring-stone-900/20 dark:border-stone-100 dark:shadow-stone-100/10 dark:ring-stone-100/20",
        isTarget &&
          "border-stone-600 shadow-lg shadow-stone-600/10 ring-2 ring-stone-600/20 dark:border-stone-400 dark:shadow-stone-400/10 dark:ring-stone-400/20",
        !isSelected &&
          !isTarget &&
          "border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700",
        !canInteract && "cursor-not-allowed opacity-60",
      )}
      onClick={canInteract ? onClick : undefined}
      whileHover={
        canInteract
          ? {
              y: -4,
              scale: 1.02,
              transition: { duration: 0.2 },
            }
          : {}
      }
      whileTap={canInteract ? { scale: 0.98 } : {}}
      animate={
        isSelected || isTarget
          ? {
              y: -4,
              boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
            }
          : {
              y: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }
      }
    >
      {/* Card Pattern */}
      <div className="absolute inset-2 rounded border border-stone-300/30 dark:border-stone-700/30">
        <div className="flex h-full items-center justify-center">
          <div className="font-serif text-xs font-light italic text-stone-600/50 dark:text-stone-400/50">Check</div>
        </div>
      </div>

      {/* Peek Indicator */}
      {isPeeked && (
        <motion.div
          className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-900/80 dark:bg-stone-100/80"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <Eye className="h-2 w-2 text-stone-100 dark:text-stone-900" />
        </motion.div>
      )}

      {/* Target Indicator */}
      {isTarget && (
        <motion.div
          className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-600/80 dark:bg-stone-400/80"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <Target className="h-2 w-2 text-stone-100 dark:text-stone-900" />
        </motion.div>
      )}

      {/* Position Number */}
      {position !== undefined && (
        <div className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-stone-300 bg-stone-50 font-mono text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
          {position}
        </div>
      )}

      {/* Interactive Glow */}
      {canInteract && (
        <motion.div
          className="absolute inset-0 rounded-lg bg-gradient-to-br from-stone-900/5 to-stone-900/10 opacity-0 dark:from-stone-100/5 dark:to-stone-100/10"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  )
}
