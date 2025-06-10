"use client"

import { AnimatePresence, motion } from "framer-motion"
import { PlayingCard } from "../cards/PlayingCard"
import type { Card, PlayerId } from "shared-types"

export interface HandGridProps {
  ownerId: PlayerId
  hand: (Card | { facedown: true })[]
  isOpponent?: boolean
  canInteract: boolean
  onCardClick?: (card: Card | { facedown: true }, index: number) => void
  selectedIndex?: number | null
}

export const HandGrid = ({
  ownerId,
  hand,
  isOpponent = false,
  canInteract,
  onCardClick,
  selectedIndex,
}: HandGridProps) => {
  return (
    <div className="flex justify-center items-center gap-2">
      <AnimatePresence>
        {hand.map((card, index) => {
          const isSelected = selectedIndex === index;

          return (
            <motion.div
              className="relative"
              key={index}
              layoutId={isOpponent ? undefined : `${ownerId}-card-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              whileHover={canInteract ? { scale: 1.08, y: -10, zIndex: 10 } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <PlayingCard
                card={'suit' in card ? card : undefined}
                isFaceDown={!('suit' in card)}
                isSelected={isSelected}
                canInteract={canInteract}
                position={index + 1}
                onClick={() => {
                  if (onCardClick) {
                    onCardClick(card, index)
                  }
                }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
} 