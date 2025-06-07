"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Crown, Shuffle } from "lucide-react"
import { useState } from "react"

interface SpecialAbilityOverlayProps {
  abilityType: string
  abilityStage: string
  allPlayers: any[]
  onStageComplete: (nextStage?: string) => void
}

export function SpecialAbilityOverlay({
  abilityType,
  abilityStage,
  allPlayers,
  onStageComplete,
}: SpecialAbilityOverlayProps) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [peekedCards, setPeekedCards] = useState<any[]>([])

  const abilityConfig = {
    KING_ABILITY: {
      icon: Crown,
      name: "King",
      color: "text-stone-900 dark:text-stone-100",
      stages: {
        peek: { title: "Peek at 2 Cards", description: "Choose any 2 cards to peek at", maxTargets: 2 },
        swap: { title: "Swap Cards", description: "Swap any 2 cards on the table", maxTargets: 2 },
      },
    },
    QUEEN_ABILITY: {
      icon: Crown,
      name: "Queen",
      color: "text-stone-900 dark:text-stone-100",
      stages: {
        peek: { title: "Peek at 1 Card", description: "Choose any 1 card to peek at", maxTargets: 1 },
        swap: { title: "Swap Cards", description: "Swap any 2 cards on the table", maxTargets: 2 },
      },
    },
    JACK_ABILITY: {
      icon: Shuffle,
      name: "Jack",
      color: "text-stone-900 dark:text-stone-100",
      stages: {
        swap: { title: "Swap Cards", description: "Swap any 2 cards on the table", maxTargets: 2 },
      },
    },
  }

  const config = abilityConfig[abilityType]
  const stageConfig = config?.stages[abilityStage]
  const Icon = config?.icon || Crown

  const handleTargetSelect = (targetId: string) => {
    setSelectedTargets((prev) => {
      if (prev.includes(targetId)) {
        return prev.filter((id) => id !== targetId)
      } else if (prev.length < stageConfig.maxTargets) {
        return [...prev, targetId]
      }
      return prev
    })
  }

  const handleStageComplete = () => {
    if (abilityStage === "peek") {
      // Simulate peeking at cards
      const mockPeekedCards = selectedTargets.map((id) => ({
        id,
        rank: "A",
        suit: "spades",
        value: -1,
      }))
      setPeekedCards(mockPeekedCards)

      // Move to swap stage if King/Queen, complete if Jack
      if (abilityType === "JACK_ABILITY") {
        onStageComplete()
      } else {
        onStageComplete("swap")
      }
    } else {
      // Complete the ability
      onStageComplete()
    }
    setSelectedTargets([])
  }

  const handleSkip = () => {
    if (abilityStage === "peek" && abilityType !== "JACK_ABILITY") {
      onStageComplete("swap")
    } else {
      onStageComplete()
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
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200/20 bg-stone-50/95 p-8 shadow-2xl backdrop-blur-xl dark:border-stone-800/20 dark:bg-stone-900/95"
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
              <Icon className={`h-8 w-8 ${config?.color}`} />
            </motion.div>
            <h2 className="text-2xl font-serif font-light text-stone-900 dark:text-stone-100">
              {config?.name} Ability
            </h2>
            <p className="text-sm font-light text-stone-600 dark:text-stone-400 mt-2">
              {stageConfig?.title}: {stageConfig?.description}
            </p>
          </div>

          {/* Peeked Cards Display */}
          {peekedCards.length > 0 && (
            <motion.div
              className="mb-6 p-4 rounded-lg bg-stone-900/10 border border-stone-900/20 dark:bg-stone-100/10 dark:border-stone-100/20"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs font-light text-stone-900 dark:text-stone-100 mb-2 text-center">
                Previously Peeked:
              </p>
              <div className="flex gap-2 justify-center">
                {peekedCards.map((card, index) => (
                  <div key={index} className="text-sm font-light text-stone-900 dark:text-stone-100">
                    {card.rank} of {card.suit}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Target Selection Grid */}
          <div className="mb-6">
            <p className="text-xs font-light text-stone-600 dark:text-stone-400 mb-3 text-center">
              Select {stageConfig?.maxTargets} target{stageConfig?.maxTargets > 1 ? "s" : ""} ({selectedTargets.length}/
              {stageConfig?.maxTargets} selected)
            </p>

            <div className="grid grid-cols-2 gap-4">
              {allPlayers.map((player) => (
                <div key={player.id} className="space-y-2">
                  <p className="text-xs font-light text-center">{player.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(player.hand || [...Array(4)]).map((card, index) => {
                      const targetId = `${player.id}-${index}`
                      const isSelected = selectedTargets.includes(targetId)

                      return (
                        <motion.div
                          key={targetId}
                          className={`w-12 h-16 rounded border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-stone-900 bg-stone-900/20 dark:border-stone-100 dark:bg-stone-100/20"
                              : "border-stone-200 hover:border-stone-300 bg-stone-100/20 dark:border-stone-800 dark:hover:border-stone-700 dark:bg-stone-900/20"
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTargetSelect(targetId)}
                        >
                          <div className="flex items-center justify-center h-full">
                            <span className="text-xs font-light text-stone-600 dark:text-stone-400">{index}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button onClick={handleSkip} variant="outline" className="flex-1 h-12 rounded-2xl text-sm font-light">
              Skip {stageConfig?.title}
            </Button>
            <Button
              onClick={handleStageComplete}
              disabled={selectedTargets.length !== stageConfig?.maxTargets}
              className="flex-1 h-12 rounded-2xl bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-sm font-light"
            >
              Confirm {stageConfig?.title}
            </Button>
          </motion.div>

          <motion.p
            className="text-center text-xs font-light text-stone-600 dark:text-stone-400 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {abilityType === "KING_ABILITY" && "King: Peek 2, then swap any 2 cards"}
            {abilityType === "QUEEN_ABILITY" && "Queen: Peek 1, then swap any 2 cards"}
            {abilityType === "JACK_ABILITY" && "Jack: Swap any 2 cards"}
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
