"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useState } from "react"
import type { Card } from "@/../shared-types"

interface CardProps {
  card: Card;
  isSelected?: boolean
  onClick?: () => void
  canInteract?: boolean
  layoutId?: string
  size?: "sm" | "md" | "lg"
}

export function CardDisplay({ card, isSelected = false, onClick, canInteract = true, layoutId, size = "md" }: CardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const sizeClasses = {
    sm: "w-12 h-16 text-xs",
    md: "w-16 h-24 text-sm",
    lg: "w-20 h-28 text-base",
  }

  const suitSymbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  }

  const suitColors: Record<string, string> = {
    hearts: "text-red-600 dark:text-red-500",
    diamonds: "text-red-600 dark:text-red-500",
    clubs: "text-stone-900 dark:text-stone-100",
    spades: "text-stone-900 dark:text-stone-100",
  }

  return (
    <motion.div
      layoutId={layoutId}
      className={cn(
        "relative cursor-pointer select-none rounded-lg border-2 bg-stone-50 transition-all duration-200 dark:bg-stone-900",
        sizeClasses[size],
        isSelected
          ? "border-stone-900 shadow-lg shadow-stone-900/10 ring-2 ring-stone-900/20 dark:border-stone-100 dark:shadow-stone-100/10 dark:ring-stone-100/20"
          : "border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700",
        !canInteract && "cursor-not-allowed opacity-60",
      )}
      onClick={canInteract ? onClick : undefined}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={
        canInteract
          ? {
              y: -8,
              rotateY: 8,
              rotateX: 5,
              scale: 1.05,
              transition: { duration: 0.2, type: "spring", stiffness: 300 },
            }
          : {}
      }
      whileTap={canInteract ? { scale: 0.95, transition: { duration: 0.1 } } : {}}
      animate={
        isSelected
          ? {
              y: -4,
              boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
            }
          : {
              y: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }
      }
      style={{
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
    >
      {/* Card Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-2">
        {/* Top Left */}
        <motion.div
          className={cn("font-serif font-light", suitColors[card.suit.toLowerCase()])}
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div>{card.rank}</div>
          <div className="text-xs leading-none">{suitSymbols[card.suit.toLowerCase()]}</div>
        </motion.div>

        {/* Center Symbol */}
        <motion.div
          className={cn(
            "absolute inset-0 flex items-center justify-center text-2xl font-light",
            suitColors[card.suit.toLowerCase()],
          )}
          animate={
            isHovered
              ? {
                  scale: 1.2,
                  rotate: [0, -5, 5, 0],
                }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.3 }}
        >
          {suitSymbols[card.suit.toLowerCase()]}
        </motion.div>

        {/* Bottom Right (Rotated) */}
        <motion.div
          className={cn("self-end rotate-180 font-serif font-light text-xs", suitColors[card.suit.toLowerCase()])}
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div>{card.rank}</div>
          <div className="leading-none">{suitSymbols[card.suit.toLowerCase()]}</div>
        </motion.div>
      </div>

      {/* Selection Glow */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute -inset-1 rounded-lg bg-gradient-to-r from-stone-900/20 via-stone-900/10 to-stone-900/20 blur-sm dark:from-stone-100/20 dark:via-stone-100/10 dark:to-stone-100/20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Hover Glow */}
      <AnimatePresence>
        {isHovered && canInteract && (
          <motion.div
            className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-stone-900/5 via-stone-900/10 to-stone-900/5 blur-sm dark:from-stone-100/5 dark:via-stone-100/10 dark:to-stone-100/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Interactive Indicator */}
      {canInteract && (
        <motion.div
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-stone-900/60 dark:bg-stone-100/60"
          animate={
            isHovered
              ? {
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 1, 0.6],
                }
              : { scale: 1, opacity: 0.6 }
          }
          transition={{ duration: 0.5, repeat: isHovered ? Number.POSITIVE_INFINITY : 0 }}
        />
      )}
    </motion.div>
  )
} 