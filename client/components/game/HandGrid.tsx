"use client"

import { AnimatePresence, motion } from "framer-motion"
import { PlayingCard } from "../cards/PlayingCard"
import type { Card, PlayerId } from "shared-types"
import { cn } from "@/lib/utils"

export interface HandGridProps {
  ownerId: PlayerId
  hand: (Card | { facedown: true })[]
  isOpponent?: boolean
  canInteract: boolean
  onCardClick?: (card: Card | { facedown: true }, index: number) => void
  selectedIndex?: number | null
  className?: string
}

export const HandGrid = ({
  ownerId,
  hand,
  isOpponent = false,
  canInteract,
  onCardClick,
  selectedIndex,
  className,
}: HandGridProps) => {
  return (
    <div className={cn(
      "relative grid grid-cols-2 gap-3 md:gap-4",
      isOpponent ? "w-[180px]" : "w-[220px]",
      className
    )}>
      <AnimatePresence>
        {hand.map((card, index) => {
          const isSelected = selectedIndex === index;
          const isFaceDown = !('suit' in card);
          const cardData = !isFaceDown ? card : undefined;

          return (
            <motion.div
              key={`${ownerId}-card-${index}`}
              layoutId={`${ownerId}-card-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 25,
                delay: index * 0.05
              }}
              className="relative"
            >
              <PlayingCard
                card={cardData}
                isFaceDown={isFaceDown}
                isSelected={isSelected}
                canInteract={canInteract}
                position={index + 1}
                size={isOpponent ? "sm" : "md"}
                onClick={() => {
                  if (onCardClick && canInteract) {
                    onCardClick(card, index)
                  }
                }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
      
      {/* Empty state */}
      {hand.length === 0 && (
        <motion.div 
          className="absolute inset-0 flex items-center justify-center col-span-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-light text-stone-500 dark:text-stone-400">
            {isOpponent ? "Opponent's hand is empty" : "Your hand is empty"}
          </p>
        </motion.div>
      )}
    </div>
  )
} 