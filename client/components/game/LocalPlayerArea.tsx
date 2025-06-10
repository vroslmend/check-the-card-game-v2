"use client"

import { AnimatePresence } from "framer-motion"
import { HandGrid } from "./HandGrid"
import { useUI } from "@/components/providers/UIMachineProvider"
import { DeckCard } from "../cards/DeckCard"
import { TurnPhase } from "shared-types"
import type { Card } from "shared-types"

export function LocalPlayerArea() {
  const [state] = useUI()
  const { currentGameState: gameState, localPlayerId } = state.context;

  if (!gameState || !localPlayerId || !gameState.players) return null;

  const localPlayer = gameState.players[localPlayerId];
  if (!localPlayer) return null;

  const isMyTurn = gameState.currentPlayerId === localPlayerId;
  const pendingCard = localPlayer.pendingDrawnCard;
  const hasPendingCard = !!pendingCard && !('facedown' in pendingCard);

  // Determine if the local player can interact with their hand
  const isAbilityActive = state.matches({ inGame: { connected: { ability: 'collectingInput' } } });
  const canInteract = (isMyTurn && gameState.turnPhase === TurnPhase.DISCARD) || isAbilityActive;

  return (
    <div className="relative w-full">
      <div className="mb-4 flex items-end justify-center" style={{ minHeight: '130px' }}>
        <AnimatePresence>
          {isMyTurn && hasPendingCard && pendingCard && (
            <div className="absolute bottom-full mb-4 transform">
              <DeckCard card={pendingCard as Card} />
            </div>
          )}
        </AnimatePresence>
      </div>

      <HandGrid
        ownerId={localPlayerId}
        hand={localPlayer.hand}
        canInteract={canInteract}
      />

      <div className="mt-4 flex justify-center">
        <div className="rounded-full bg-stone-200/50 px-4 py-1.5 dark:bg-stone-800/50">
          <p className="text-center text-sm font-medium text-stone-700 dark:text-stone-300">
            {localPlayer.name} (You)
          </p>
        </div>
      </div>
    </div>
  )
}