"use client"

import { motion } from "framer-motion"
import { Card } from "./Card"
import { CardBack } from "./CardBack"

interface HandGridProps {
  cards: any[]
  selectedCards: string[]
  selectedTargets: string[]
  onCardSelect: (cardId: string) => void
  onTargetSelect: (targetId: string) => void
  canInteract: boolean
  gamePhase: string
}

export function HandGrid({
  cards,
  selectedCards,
  selectedTargets,
  onCardSelect,
  onTargetSelect,
  canInteract,
  gamePhase,
}: HandGridProps) {
  // Arrange cards in 2x2 grid with expansion for additional cards
  const arrangeCardsInGrid = (cards: any[]) => {
    const grid = []
    const maxRowWidth = 2

    for (let i = 0; i < cards.length; i += maxRowWidth) {
      grid.push(cards.slice(i, i + maxRowWidth))
    }

    return grid
  }

  const cardGrid = arrangeCardsInGrid(cards)

  return (
    <div className="relative min-h-[200px] rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-100/5 to-stone-200/10 p-6 backdrop-blur-sm dark:border-stone-800/60 dark:bg-gradient-to-br dark:from-stone-900/5 dark:to-stone-800/10">
      {/* Grid Layout Indicator */}
      <div className="absolute left-4 top-4">
        <span className="text-xs font-light text-stone-600 dark:text-stone-400">2×2 Grid</span>
      </div>

      {/* Background Grid Pattern */}
      <div className="absolute inset-4 opacity-5">
        <div className="grid h-full grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded border border-dashed border-current" />
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <motion.div
          className="flex h-full w-full items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-4 text-center">
            <div className="mx-auto grid w-fit grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-dashed border-stone-200/50 bg-stone-100/20 dark:border-stone-800/50 dark:bg-stone-900/20"
                  animate={{
                    borderColor: ["hsl(var(--border))", "hsl(var(--muted-foreground))", "hsl(var(--border))"],
                  }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }}
                >
                  <span className="text-xs font-light text-stone-600 dark:text-stone-400">?</span>
                </motion.div>
              ))}
            </div>
            <p className="text-sm font-light text-stone-600 dark:text-stone-400">Empty hand - Check called!</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="flex h-full flex-col items-center justify-center gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.1,
              },
            },
          }}
        >
          {cardGrid.map((row, rowIndex) => (
            <motion.div
              key={rowIndex}
              className="flex gap-4"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              {row.map((card, colIndex) => {
                const position = rowIndex * 2 + colIndex
                const isBottomRow = rowIndex === cardGrid.length - 1 && cardGrid.length <= 2
                const isInitialPeekCard = position >= 2 && position <= 3 // Bottom two cards in 2x2

                return (
                  <motion.div
                    key={card.id}
                    className="relative"
                    variants={{
                      hidden: { opacity: 0, scale: 0.8, rotate: -10 },
                      visible: {
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                      },
                    }}
                    transition={{
                      duration: 0.5,
                      type: "spring",
                      stiffness: 150,
                      damping: 12,
                    }}
                    style={{
                      zIndex: selectedCards.includes(card.id) || selectedTargets.includes(card.id) ? 10 : 5 - position,
                    }}
                  >
                    {/* Position Indicator */}
                    <div className="absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                      {position}
                    </div>

                    {/* Initial Peek Indicator */}
                    {isInitialPeekCard && gamePhase === "initialPeek" && (
                      <motion.div
                        className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-stone-900 dark:bg-stone-100"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.7, 1, 0.7],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                      />
                    )}

                    {card.isFaceDown ? (
                      <CardBack
                        size="md"
                        layoutId={`card-${card.id}`}
                        onClick={() => canInteract && onCardSelect(card.id)}
                        isSelected={selectedCards.includes(card.id)}
                        isTarget={selectedTargets.includes(card.id)}
                        canInteract={canInteract}
                        isPeeked={card.isPeeked}
                        position={position}
                      />
                    ) : (
                      <Card
                        card={card}
                        isSelected={selectedCards.includes(card.id) || selectedTargets.includes(card.id)}
                        onClick={() => canInteract && onCardSelect(card.id)}
                        canInteract={canInteract}
                        layoutId={`card-${card.id}`}
                        size="md"
                      />
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Selection Info */}
      {(selectedCards.length > 0 || selectedTargets.length > 0) && (
        <motion.div
          className="absolute bottom-2 right-2 rounded-full border border-stone-900/30 bg-stone-900/20 px-3 py-1 dark:border-stone-100/30 dark:bg-stone-100/20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <span className="text-xs font-medium text-stone-900 dark:text-stone-100">
            {selectedCards.length > 0 && `${selectedCards.length} selected`}
            {selectedCards.length > 0 && selectedTargets.length > 0 && " • "}
            {selectedTargets.length > 0 && `${selectedTargets.length} targeted`}
          </span>
        </motion.div>
      )}
    </div>
  )
}
