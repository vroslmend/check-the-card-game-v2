"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "./Card"
import { Users, X } from "lucide-react"
import { useState } from "react"

interface MatchingOpportunityOverlayProps {
  discardedCard: any
  playerHand: any[]
  onMatch: (cardId: string) => void
  onPass: () => void
}

export function MatchingOpportunityOverlay({
  discardedCard,
  playerHand,
  onMatch,
  onPass,
}: MatchingOpportunityOverlayProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  // Find matching cards in hand
  const matchingCards = playerHand.filter((card) => !card.isFaceDown && card.rank === discardedCard.rank)

  const handleMatch = () => {
    if (selectedCard) {
      onMatch(selectedCard)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/20 bg-stone-50/95 p-8 shadow-2xl backdrop-blur-xl dark:border-stone-800/20 dark:bg-stone-900/95"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
        >
          <div className="text-center mb-6">
            <motion.div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Users className="h-8 w-8 text-stone-700 dark:text-stone-300" />
            </motion.div>
            <h2 className="text-2xl font-serif font-light text-stone-900 dark:text-stone-100">Matching Opportunity</h2>
            <p className="text-sm font-light text-stone-600 dark:text-stone-400 mt-2">
              Match the discarded card or pass
            </p>
          </div>

          {/* Discarded Card */}
          <div className="text-center mb-6">
            <p className="text-xs font-light text-stone-600 dark:text-stone-400 mb-2">Discarded Card:</p>
            <motion.div
              className="inline-block"
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <Card card={discardedCard} canInteract={false} layoutId={`discard-${discardedCard.id}`} size="lg" />
            </motion.div>
          </div>

          {/* Matching Cards */}
          {matchingCards.length > 0 ? (
            <div className="mb-6">
              <p className="text-xs font-light text-stone-600 dark:text-stone-400 mb-3 text-center">
                Your matching cards:
              </p>
              <motion.div
                className="flex gap-3 justify-center"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.5,
                    },
                  },
                }}
              >
                {matchingCards.map((card) => (
                  <motion.div
                    key={card.id}
                    variants={{
                      hidden: { opacity: 0, y: 20, scale: 0.8 },
                      visible: { opacity: 1, y: 0, scale: 1 },
                    }}
                    whileHover={{ y: -4, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`cursor-pointer ${selectedCard === card.id ? "ring-2 ring-stone-900 dark:ring-stone-100 rounded-lg" : ""}`}
                    onClick={() => setSelectedCard(card.id)}
                  >
                    <Card
                      card={card}
                      isSelected={selectedCard === card.id}
                      canInteract={true}
                      layoutId={`match-${card.id}`}
                      size="md"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ) : (
            <motion.div
              className="text-center mb-6 p-4 rounded-lg bg-stone-100/20 dark:bg-stone-800/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <X className="h-8 w-8 text-stone-600 dark:text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-light text-stone-600 dark:text-stone-400">No matching cards available</p>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Button onClick={onPass} variant="outline" className="flex-1 h-12 rounded-2xl text-sm font-light">
              Pass
            </Button>
            <Button
              onClick={handleMatch}
              disabled={!selectedCard}
              className="flex-1 h-12 rounded-2xl bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-sm font-light"
            >
              Match Selected
            </Button>
          </motion.div>

          <motion.p
            className="text-center text-xs font-light text-stone-600 dark:text-stone-400 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Matching reduces your hand size
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
