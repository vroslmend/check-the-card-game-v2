"use client"

import { motion } from "framer-motion"
import { CardDisplay } from "../ui/CardDisplay"
import { Lock, Eye } from "lucide-react"
import { ClientCard, Card } from "shared-types"

interface DiscardPileProps {
  cards: ClientCard[]
  isSealed: boolean
  canDraw?: boolean
  onClick?: () => void
}

export function DiscardPile({ cards, isSealed, canDraw = false, onClick }: DiscardPileProps) {
  const topCard = cards.length > 0 ? cards[0] : null;

  return (
    <div 
      className={`relative ${canDraw ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="mb-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm font-serif font-light text-stone-700 dark:text-stone-300">Discard Pile</p>
          {isSealed && <Lock className="h-3 w-3 text-stone-600 dark:text-stone-400" />}
          {canDraw && <Eye className="h-3 w-3 text-stone-900 dark:text-stone-100" />}
        </div>
        <p className="text-xs font-light text-stone-600 dark:text-stone-400">{cards.length} cards</p>
      </div>

      <motion.div 
        className="relative h-24 w-16"
        whileHover={{ scale: canDraw && !isSealed ? 1.05 : 1 }}
        whileTap={{ scale: canDraw && !isSealed ? 0.95 : 1 }}
      >
        {topCard && 'suit' in topCard ? (
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardDisplay card={topCard as Card} canInteract={canDraw && !isSealed} layoutId={`discard-${topCard.id}`} />

            {/* Sealed Overlay */}
            {isSealed && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-stone-200/60 backdrop-blur-sm dark:bg-stone-800/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Lock className="h-6 w-6 text-stone-600 dark:text-stone-400" />
              </motion.div>
            )}

            {/* Draw Indicator */}
            {canDraw && !isSealed && (
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
                <Eye className="h-2 w-2 text-stone-100 dark:text-stone-900" />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-stone-200/50 bg-stone-100/20 dark:border-stone-800/50 dark:bg-stone-900/20">
            <span className="text-xs font-light text-stone-600 dark:text-stone-400">Empty</span>
          </div>
        )}
      </motion.div>

      {/* Status Text */}
      <motion.p
        className="mt-2 text-center text-xs font-light"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      >
        {isSealed && <span className="text-stone-600 dark:text-stone-400">Sealed</span>}
        {canDraw && !isSealed && <span className="text-stone-900 dark:text-stone-100">Available to draw</span>}
        {!canDraw && !isSealed && <span className="text-stone-600 dark:text-stone-400">View only</span>}
      </motion.p>
    </div>
  )
} 