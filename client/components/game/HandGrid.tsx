"use client"

import { AnimatePresence, motion, LayoutGroup } from "framer-motion"
import { PlayingCard } from "@/components/cards/PlayingCard"
import type { Card, PlayerId } from "shared-types"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useState } from 'react'

export interface HandGridProps {
  ownerId: PlayerId
  hand: (Card | { facedown: true })[]
  isOpponent?: boolean
  canInteract: boolean
  onCardClick?: (card: Card | { facedown: true }, index: number) => void
  selectedCardIndices?: number[]
  highlightedCardIndices?: number[]
  className?: string
}

export const HandGrid = ({
  ownerId,
  hand,
  isOpponent = false,
  canInteract,
  onCardClick,
  selectedCardIndices = [],
  highlightedCardIndices = [],
  className,
}: HandGridProps) => {
  // Organize cards into a grid
  // For example: with 4 cards, we want a 2x2 grid
  // With 5-6 cards, we want a 2x3 grid, etc.
  const [cardSize, setCardSize] = useState<'xs' | 'sm' | 'md'>('sm')

  useEffect(() => {
    // Determine card size based on viewport width and hand size
    const calculateCardSize = () => {
      const width = window.innerWidth
      
      if (width < 640) {
        // Small screens: smaller cards
        return hand.length > 6 ? 'xs' : 'sm'
      } else {
        // Larger screens: medium sized cards for normal hands
        return hand.length > 8 ? 'sm' : 'md'
      }
    }
    
    // Set initial size
    setCardSize(calculateCardSize())
    
    // Add window resize listener
    const handleResize = () => setCardSize(calculateCardSize())
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [hand.length])
  
  const gridCells = useMemo(() => {
    // Figure out how many cards per row
    // We aim for a max of 2 cards per row, expanding to more columns as needed
    const cardsPerRow = 2
    const numRows = Math.ceil(hand.length / cardsPerRow)
    
    // Create a 2D array to represent rows and columns
    return Array.from({ length: numRows }, (_, rowIndex) => {
      return Array.from({ length: cardsPerRow }, (_, colIndex) => {
        const cardIndex = rowIndex * cardsPerRow + colIndex
        return cardIndex < hand.length ? hand[cardIndex] : null
      })
    })
  }, [hand])
  
  // Calculate the gap between cards based on the card size
  const gapClass = {
    'xs': 'gap-1',
    'sm': 'gap-1.5',
    'md': 'gap-2'
  }[cardSize]

  return (
    <LayoutGroup id={`hand-${ownerId}`}>
      <div className={cn(
        "grid", 
        gapClass, 
        hand.length > 0 ? "" : "min-h-[60px]",
        isOpponent ? "opacity-95 scale-90" : ""
      )} style={{ gridTemplateRows: `repeat(${gridCells.length}, auto)` }}>
        {gridCells.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={cn("flex", gapClass)}>
            {row.map((card, colIndex) => {
              const cardIndex = rowIndex * 2 + colIndex
              
              if (!card) return <div key={`empty-${cardIndex}`} className="invisible" />

              const cardKey = 'facedown' in card ? `${ownerId}-facedown-${cardIndex}` : `${ownerId}-${card.suit}-${card.rank}-${cardIndex}`
              const isSelected = selectedCardIndices.includes(cardIndex);
              const isHighlighted = highlightedCardIndices.includes(cardIndex);
              
              return (
                <div 
                  key={cardKey}
                  className={cn(
                    "relative",
                    canInteract && 'cursor-pointer',
                    // Bottom row gets a special highlight in the initial peek phase
                    rowIndex === gridCells.length - 1 && !isOpponent && "z-10"
                  )}
                  onClick={() => canInteract && onCardClick?.(card, cardIndex)}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={cardKey}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: isSelected ? 1.05 : 1, 
                        opacity: 1,
                        y: isSelected ? -4 : 0 
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "relative transition-transform",
                        canInteract && "hover:scale-105 hover:-translate-y-1 active:scale-95",
                        isSelected && "ring-2 ring-blue-500 rounded-lg ring-offset-2 ring-offset-stone-100 dark:ring-offset-zinc-900",
                        isHighlighted && "ring-2 ring-purple-500 rounded-lg ring-offset-2 ring-offset-stone-100 dark:ring-offset-zinc-900"
                      )}
                    >
                      <PlayingCard
                        card={'facedown' in card ? undefined : card}
                        size={cardSize}
                        faceDown={'facedown' in card}
                        className={cn(
                          "shadow-sm", 
                          canInteract && "cursor-pointer",
                          (isSelected || isHighlighted) && "shadow-md"
                        )}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </LayoutGroup>
  )
} 