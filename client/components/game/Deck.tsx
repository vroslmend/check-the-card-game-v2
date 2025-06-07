"use client"

import { motion } from "framer-motion"
import { CardBack } from "../ui/CardBack"
import { Plus } from "lucide-react"

interface DeckProps {
  count: number
  canDraw: boolean
  onClick?: () => void
}

export function Deck({ count, canDraw, onClick }: DeckProps) {
  return (
    <div 
      className={`relative ${canDraw ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="mb-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm font-serif font-light text-stone-700 dark:text-stone-300">Deck</p>
          {canDraw && <Plus className="h-3 w-3 text-stone-900 dark:text-stone-100" />}
        </div>
        <p className="text-xs font-light text-stone-600 dark:text-stone-400">{count} cards remaining</p>
      </div>

      <motion.div 
        className="relative"
        whileHover={{ scale: canDraw ? 1.05 : 1 }}
        whileTap={{ scale: canDraw ? 0.95 : 1 }}
      >
        {/* Stack effect with multiple card backs */}
        {[...Array(Math.min(count, 3))].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              zIndex: 3 - i,
              x: i * 2,
              y: i * -2,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <CardBack size="md" />
          </motion.div>
        ))}

        {/* Invisible spacer for layout */}
        <div className="opacity-0 h-24 w-16">
          <CardBack size="md" />
        </div>

        {/* Draw Indicator */}
        {canDraw && (
          <motion.div
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-900 dark:bg-stone-100"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
            }}
          >
            <Plus className="h-2 w-2 text-stone-100 dark:text-stone-900" />
          </motion.div>
        )}
      </motion.div>

      {/* Status Text */}
      <motion.p
        className="mt-2 text-center text-xs font-light"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      >
        {canDraw ? (
          <span className="text-stone-900 dark:text-stone-100">Available to draw</span>
        ) : (
          <span className="text-stone-600 dark:text-stone-400">View only</span>
        )}
      </motion.p>
    </div>
  )
} 