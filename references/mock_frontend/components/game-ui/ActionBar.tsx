"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useState, useRef } from "react"
import { CheckCircle, Circle, Crown, Eye, Shuffle, Users } from "lucide-react"

interface ActionBarProps {
  gamePhase: string
  selectedCards: string[]
  canPlay: boolean
  onAction: (action: any) => void
  uiState: any
  pendingAbility?: any
}

export function ActionBar({ gamePhase, selectedCards, canPlay, onAction, uiState, pendingAbility }: ActionBarProps) {
  const [holdingAction, setHoldingAction] = useState<string | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startHold = (actionType: string) => {
    if (!canPlay || uiState.phase === "processing") return

    setHoldingAction(actionType)
    setHoldProgress(0)

    progressIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        const newProgress = prev + 2
        if (newProgress >= 100) {
          completeHold(actionType)
          return 100
        }
        return newProgress
      })
    }, 20)

    holdTimeoutRef.current = setTimeout(() => {
      completeHold(actionType)
    }, 1000)
  }

  const completeHold = (actionType: string) => {
    clearHold()
    onAction({ type: actionType })
  }

  const clearHold = () => {
    setHoldingAction(null)
    setHoldProgress(0)
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  // Define actions based on game phase
  const getAvailableActions = () => {
    const baseActions = []

    if (gamePhase === "initialPeek") {
      return [
        {
          id: "initial_peek",
          label: "Peek at Bottom Cards",
          disabled: !canPlay,
          variant: "ghost" as const,
          holdToConfirm: false,
          description: "Look at positions 2 & 3",
          icon: Eye,
        },
      ]
    }

    if (gamePhase === "playPhase") {
      baseActions.push(
        {
          id: "draw_deck",
          label: "Draw from Deck",
          disabled: !canPlay || uiState.phase === "processing",
          variant: "ghost" as const,
          holdToConfirm: false,
          description: "Draw face-down card",
          icon: Circle,
        },
        {
          id: "draw_discard",
          label: "Draw from Discard",
          disabled: !canPlay || uiState.phase === "processing",
          variant: "ghost" as const,
          holdToConfirm: false,
          description: "Draw visible card (if available)",
          icon: Eye,
        },
      )

      if (selectedCards.length > 0) {
        baseActions.push({
          id: "swap_card",
          label: "Swap Selected",
          disabled: !canPlay || selectedCards.length !== 1,
          variant: "ghost" as const,
          holdToConfirm: false,
          description: `Swap selected card with drawn card`,
          icon: Shuffle,
        })
      }

      baseActions.push({
        id: "call_check",
        label: "Call Check!",
        disabled: !canPlay || uiState.phase === "processing",
        variant: "ghost" as const,
        holdToConfirm: true,
        description: "End the round - others get final turns",
        icon: CheckCircle,
      })
    }

    if (gamePhase === "matchingStage") {
      baseActions.push(
        {
          id: "attempt_match",
          label: "Attempt Match",
          disabled: !canPlay || selectedCards.length !== 1,
          variant: "ghost" as const,
          holdToConfirm: false,
          description: "Match with selected card",
          icon: Users,
        },
        {
          id: "pass_match",
          label: "Pass",
          disabled: !canPlay,
          variant: "ghost" as const,
          holdToConfirm: false,
          description: "Skip matching opportunity",
          icon: Circle,
        },
      )
    }

    if (gamePhase === "abilityResolutionStage" && pendingAbility) {
      const abilityActions = {
        KING: {
          id: "king_ability",
          label: "Resolve King",
          description: "Peek 2 cards, then swap any 2",
          icon: Crown,
        },
        QUEEN: {
          id: "queen_ability",
          label: "Resolve Queen",
          description: "Peek 1 card, then swap any 2",
          icon: Crown,
        },
        JACK: {
          id: "jack_ability",
          label: "Resolve Jack",
          description: "Swap any 2 cards",
          icon: Shuffle,
        },
      }

      const ability = abilityActions[pendingAbility.type]
      if (ability) {
        baseActions.push({
          ...ability,
          disabled: !canPlay,
          variant: "ghost" as const,
          holdToConfirm: false,
        })
      }
    }

    return baseActions
  }

  const actions = getAvailableActions()

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Phase-specific instructions */}
      <motion.div
        className="rounded-lg border border-stone-200/30 bg-stone-100/20 p-3 text-center dark:border-stone-800/30 dark:bg-stone-900/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-sm font-light text-stone-600 dark:text-stone-400">
          {gamePhase === "initialPeek" && "Look at your bottom two cards (positions 2 & 3)"}
          {gamePhase === "playPhase" && "Draw a card, then discard or swap"}
          {gamePhase === "matchingStage" && "Match the discarded card or pass"}
          {gamePhase === "abilityResolutionStage" && "Resolve your special card ability"}
          {gamePhase === "finalTurnsPhase" && "Final turn - make it count!"}
          {gamePhase === "scoringPhase" && "Calculating final scores..."}
        </p>
      </motion.div>

      {/* Action Buttons */}
      <div className="rounded-lg border border-stone-200/50 bg-stone-100/10 p-4 dark:border-stone-800/50 dark:bg-stone-900/10">
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((action) => {
            const ActionIcon = action.icon

            return (
              <motion.div
                key={action.id}
                className="relative"
                whileHover={!action.disabled ? { scale: 1.02 } : {}}
                whileTap={!action.disabled ? { scale: 0.98 } : {}}
              >
                {action.holdToConfirm ? (
                  <div className="relative">
                    <Button
                      variant={action.variant}
                      disabled={action.disabled}
                      className="relative min-w-[140px] overflow-hidden text-sm font-light transition-all duration-200"
                      onMouseDown={() => startHold(action.id.toUpperCase())}
                      onMouseUp={clearHold}
                      onMouseLeave={clearHold}
                      onTouchStart={() => startHold(action.id.toUpperCase())}
                      onTouchEnd={clearHold}
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {holdingAction === action.id.toUpperCase() ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                          >
                            <ActionIcon className="h-3 w-3" />
                          </motion.div>
                        ) : (
                          <>
                            <ActionIcon className="h-3 w-3" />
                            {action.label}
                          </>
                        )}
                      </span>

                      <AnimatePresence>
                        {holdingAction === action.id.toUpperCase() && (
                          <motion.div
                            className="absolute inset-0 bg-stone-900/20 dark:bg-stone-100/20"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: holdProgress / 100 }}
                            exit={{ scaleX: 0 }}
                            style={{ originX: 0 }}
                            transition={{ duration: 0.1 }}
                          />
                        )}
                      </AnimatePresence>
                    </Button>

                    {!action.disabled && (
                      <motion.p
                        className="mt-1 text-center text-xs font-light text-stone-600 dark:text-stone-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Hold to confirm
                      </motion.p>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Button
                      variant={action.variant}
                      disabled={action.disabled}
                      onClick={() => onAction({ type: action.id.toUpperCase() })}
                      className="min-w-[140px] text-sm font-light transition-all duration-200"
                    >
                      <AnimatePresence mode="wait">
                        {uiState.phase === "processing" && uiState.action === action.id.toUpperCase() ? (
                          <motion.div
                            key="processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                              className="h-3 w-3 rounded-full border border-current border-t-transparent"
                            />
                            Processing...
                          </motion.div>
                        ) : (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <ActionIcon className="h-3 w-3" />
                            {action.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>

                    {!action.disabled && action.description && (
                      <motion.p
                        className="mt-1 text-center text-xs font-light text-stone-600 dark:text-stone-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {action.description}
                      </motion.p>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Game State Info */}
      <motion.div
        className="flex items-center justify-between rounded-lg border border-stone-200/30 bg-stone-100/20 p-3 text-xs font-light text-stone-600 dark:border-stone-800/30 dark:bg-stone-900/20 dark:text-stone-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <span>Selected:</span>
          <motion.span
            className={
              selectedCards.length > 0 ? "text-stone-900 dark:text-stone-100" : "text-stone-600 dark:text-stone-400"
            }
            animate={selectedCards.length > 0 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.2 }}
          >
            {selectedCards.length}
          </motion.span>
        </div>

        <div className="flex items-center gap-2">
          <span>Phase:</span>
          <span className="text-stone-900 dark:text-stone-100">{gamePhase}</span>
        </div>

        <div className="flex items-center gap-2">
          {canPlay ? (
            <motion.div
              className="flex items-center gap-1 text-stone-900 dark:text-stone-100"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <CheckCircle className="h-3 w-3" />
              <span>Your Turn</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3" />
              <span>Waiting</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
