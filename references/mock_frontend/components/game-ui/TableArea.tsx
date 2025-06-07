"use client"

import { motion } from "framer-motion"
import { Deck } from "./Deck"
import { DiscardPile } from "./DiscardPile"
import { AlertCircle } from "lucide-react"

interface TableAreaProps {
  deck: { count: number }
  discardPile: any[]
  currentPlayer: string
  gamePhase: string
  discardPileIsSealed: boolean
  matchingOpportunityInfo: any
}

export function TableArea({
  deck,
  discardPile,
  currentPlayer,
  gamePhase,
  discardPileIsSealed,
  matchingOpportunityInfo,
}: TableAreaProps) {
  return (
    <div className="flex items-center justify-center gap-12">
      {/* Deck */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Deck count={deck.count} canDraw={gamePhase === "playPhase"} />
      </motion.div>

      {/* Center Game Info */}
      <motion.div
        className="space-y-3 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="rounded-lg border border-stone-200/50 bg-stone-100/30 px-6 py-4 dark:border-stone-800/50 dark:bg-stone-900/30">
          <p className="text-sm font-serif font-light text-stone-600 dark:text-stone-400">Table Center</p>
          <p className="mt-1 text-xs font-light text-stone-600 dark:text-stone-400">Current: {currentPlayer}</p>
          <p className="mt-1 text-xs font-light text-stone-900 dark:text-stone-100">Phase: {gamePhase}</p>
        </div>

        {/* Matching Opportunity Indicator */}
        {matchingOpportunityInfo && (
          <motion.div
            className="rounded-lg border border-stone-900/50 bg-stone-900/10 px-4 py-2 dark:border-stone-100/50 dark:bg-stone-100/10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="flex items-center justify-center gap-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
              >
                <AlertCircle className="h-4 w-4 text-stone-900 dark:text-stone-100" />
              </motion.div>
              <p className="text-xs font-light text-stone-900 dark:text-stone-100">Matching Available</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Discard Pile */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <DiscardPile cards={discardPile} isSealed={discardPileIsSealed} />
      </motion.div>
    </div>
  )
}
