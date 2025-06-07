"use client"

import { motion } from "framer-motion"
import { HandGrid } from "./HandGrid"
import { ActionBar } from "./ActionBar"
import { GamePhaseIndicator } from "./GamePhaseIndicator"

interface LocalPlayerAreaProps {
  player: {
    id: string
    name: string
    hand: any[]
    canPlay: boolean
    isLocked: boolean
    hasCalledCheck: boolean
    pendingSpecialAbility: any
  }
  gamePhase: string
  selectedCards: string[]
  selectedTargets: string[]
  onCardSelect: (cardId: string) => void
  onTargetSelect: (targetId: string) => void
  onAction: (action: any) => void
  uiState: any
}

export function LocalPlayerArea({
  player,
  gamePhase,
  selectedCards,
  selectedTargets,
  onCardSelect,
  onTargetSelect,
  onAction,
  uiState,
}: LocalPlayerAreaProps) {
  return (
    <div className="space-y-6">
      {/* Player Info & Phase */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h3 className="font-serif text-lg font-light tracking-tight">{player.name}</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm font-light text-stone-600 dark:text-stone-400">
              Your Hand • {player.hand.length} cards
            </p>
            {player.hasCalledCheck && (
              <motion.span
                className="rounded bg-stone-900/10 px-2 py-1 text-xs font-light text-stone-900 dark:bg-stone-100/10 dark:text-stone-100"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                Check!
              </motion.span>
            )}
            {player.isLocked && (
              <motion.span
                className="rounded bg-stone-200/20 px-2 py-1 text-xs font-light text-stone-600 dark:bg-stone-800/20 dark:text-stone-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                Locked
              </motion.span>
            )}
          </div>
        </div>

        <GamePhaseIndicator
          phase={gamePhase}
          isPlayerTurn={player.canPlay}
          pendingAbility={player.pendingSpecialAbility}
        />
      </motion.div>

      {/* Hand Grid (2x2 layout) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <HandGrid
          cards={player.hand}
          selectedCards={selectedCards}
          selectedTargets={selectedTargets}
          onCardSelect={onCardSelect}
          onTargetSelect={onTargetSelect}
          canInteract={player.canPlay && !player.isLocked}
          gamePhase={gamePhase}
        />
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <ActionBar
          gamePhase={gamePhase}
          selectedCards={selectedCards}
          canPlay={player.canPlay && !player.isLocked}
          onAction={onAction}
          uiState={uiState}
          pendingAbility={player.pendingSpecialAbility}
        />
      </motion.div>
    </div>
  )
}
