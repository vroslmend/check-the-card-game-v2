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
  maxCards?: number
  className?: string
  visibleCardIndices?: number[]
}

export const HandGrid = ({
  ownerId,
  hand,
  isOpponent = false,
  canInteract,
  onCardClick,
  selectedIndex,
  maxCards = 7,
  className,
  visibleCardIndices = [],
}: HandGridProps) => {
  // Calculate fan angle and overlap based on number of cards
  const cardCount = hand.length;
  const maxOverlap = Math.min(55, 400 / Math.max(cardCount, 1)); // More cards = more overlap
  const cardWidth = 80; // Width in pixels
  
  // For a nice looking fan effect, calculate positions
  const totalWidth = cardWidth + (cardCount - 1) * (cardWidth - maxOverlap);
  const startX = -totalWidth / 2 + cardWidth / 2;

  return (
    <div className={cn(
      "relative flex justify-center items-center h-[170px]",
      isOpponent ? "mt-4" : "mb-4",
      className
    )}>
      <AnimatePresence>
        {hand.map((card, index) => {
          const isSelected = selectedIndex === index;
          const isVisible = visibleCardIndices.includes(index);
          
          // Calculate fan position
          const xPos = startX + index * (cardWidth - maxOverlap);
          
          // Calculate z-index and subtle rotation for fan effect
          const zIndex = index;
          const rotation = isOpponent 
            ? 0 // No rotation for opponents
            : (index - (cardCount - 1) / 2) * 2; // Slight rotation for local player
          
          return (
            <motion.div
              className="absolute origin-bottom"
              key={`${ownerId}-card-${index}`}
              layoutId={isOpponent ? undefined : `${ownerId}-card-${index}`}
              initial={{ opacity: 0, y: 30, rotateZ: 0 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                x: xPos,
                rotateZ: rotation,
                zIndex: isSelected ? 50 : zIndex
              }}
              exit={{ opacity: 0, y: isOpponent ? -30 : 30, transition: { duration: 0.3 } }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25,
                delay: index * 0.03 // Staggered animation
              }}
            >
              <PlayingCard
                card={'suit' in card ? card : undefined}
                isFaceDown={!('suit' in card) && !isVisible}
                isSelected={isSelected}
                isPeeked={isVisible}
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
          className="flex items-center justify-center h-full"
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