"use client"

import { motion, AnimatePresence } from "framer-motion"
import { HandGrid } from "./HandGrid"
import { ActionBar } from "./ActionBar"
import { GamePhaseIndicator } from "./GamePhaseIndicator"
import { useUIMachineSelector } from "@/machines/uiMachineProvider"
import { ClientCard, Card } from "shared-types"

interface LocalPlayerAreaProps {
  onCardClick: (card: ClientCard, index: number) => void;
}

export function LocalPlayerArea({ onCardClick }: LocalPlayerAreaProps) {
  const localPlayerId = useUIMachineSelector((state) => state.context.localPlayerId);
  const player = useUIMachineSelector((state) => 
    state.context.localPlayerId ? state.context.currentGameState?.players[state.context.localPlayerId] : null
  );
  const gamePhase = useUIMachineSelector((state) => {
    if (state.matches('initialSetup')) return 'initialSetup';
    if (state.matches('playerAction')) return 'playerAction';
    if (state.matches('awaitingServerResponse')) return 'waitingForServer';
    if (state.matches('idle')) return 'playerAction';
    return 'waitingForServer';
  });
  const isPlayerTurn = useUIMachineSelector((state) => state.matches('idle') || state.matches('playerAction'));
  const selectedCardId = useUIMachineSelector((state) => {
    const index = state.context.selectedHandCardIndex;
    if (index === null || !player?.hand) return null;
    return player.hand[index]?.id;
  });
  const peekableCards = useUIMachineSelector((state) => {
    const cardsToPeek = state.context.currentGameState?.players[state.context.localPlayerId!]?.cardsToPeek;
    if (!cardsToPeek || !player?.hand) return null;
    return cardsToPeek.map(card => ({
      card,
      index: player.hand.findIndex(handCard => handCard.id === card.id)
    })).filter(item => item.index !== -1);
  });

  if (!player || !localPlayerId) {
    return null; // Or a loading state
  }

  return (
    <div className="space-y-6">
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
          </div>
        </div>

        <GamePhaseIndicator
          phase={gamePhase as any}
          isPlayerTurn={isPlayerTurn}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <HandGrid
          cards={player.hand}
          selectedCardId={selectedCardId}
          onCardClick={onCardClick}
          canInteract={isPlayerTurn}
          gamePhase={gamePhase}
          peekableCards={peekableCards}
        />
      </motion.div>

      <AnimatePresence>
        {isPlayerTurn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <ActionBar />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 