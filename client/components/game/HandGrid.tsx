"use client"

import { motion } from "framer-motion"
import { CardDisplay } from "../ui/CardDisplay"
import { CardBack } from "../ui/CardBack"
import { ClientCard, Card } from "shared-types"

interface HandGridProps {
  cards: ClientCard[]
  selectedCardId?: string | null
  onCardClick: (card: ClientCard, index: number) => void
  canInteract: boolean
  gamePhase: string // From UI Machine
  peekableCards?: { card: Card; index: number }[] | null
}

export function HandGrid({
  cards,
  selectedCardId,
  onCardClick,
  canInteract,
  gamePhase,
  peekableCards,
}: HandGridProps) {
  const cardGrid = [cards.slice(0, 2), cards.slice(2, 4)];

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
                const cardIndex = rowIndex * 2 + colIndex;
                const isSelected = selectedCardId === card.id;
                
                // During peek phase, show the peekable cards face up
                const peekCard = peekableCards?.find(p => p.index === cardIndex);
                const displayCard = peekCard ? peekCard.card : card;
                const isFaceUp = !!peekCard || ('suit' in displayCard);

                return (
                  <motion.div
                    key={card.id}
                    layout
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
                      zIndex: isSelected ? 10 : 5 - cardIndex,
                    }}
                    drag={canInteract}
                    dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                    dragSnapToOrigin={true}
                    dragElastic={0.2}
                    whileDrag={{ scale: 1.05, zIndex: 20 }}
                  >
                    {isFaceUp && 'suit' in displayCard ? (
                      <CardDisplay
                        card={displayCard}
                        isSelected={isSelected}
                        onClick={() => canInteract && onCardClick(displayCard, cardIndex)}
                        canInteract={canInteract}
                        layoutId={`card-${card.id}`}
                        size="md"
                      />
                    ) : (
                      <CardBack
                        size="md"
                        layoutId={`card-${card.id}`}
                        onClick={() => canInteract && onCardClick(card, cardIndex)}
                        isSelected={isSelected}
                        canInteract={canInteract}
                      />
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
} 