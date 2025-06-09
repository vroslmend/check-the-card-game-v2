"use client"

import { AnimatePresence } from "framer-motion"
import { HandGrid } from "./HandGrid"
import { useUI } from "@/components/providers/uiMachineProvider"
import { DeckCard } from "../cards/DeckCard"
import { type UIMachineEvent } from "@/machines/uiMachine"
import { type ClientCard, type Card } from "shared-types"

export function LocalPlayerArea() {
  const [state, send] = useUI()
  const { currentGameState: gameState, localPlayerId, selectedHandCardIndex } = state.context;

  if (!gameState || !localPlayerId) return null;

  const localPlayer = gameState.players[localPlayerId];
  if (!localPlayer) return null;

  const isMyTurn = gameState.currentPlayerId === localPlayerId;
  const hasPendingCard = !!localPlayer.pendingDrawnCard;

  const selectedCardId =
    selectedHandCardIndex !== null && localPlayer.hand[selectedHandCardIndex]
      ? localPlayer.hand[selectedHandCardIndex].id
      : null;

  const handleCardClick = (card: ClientCard, index: number) => {
    const event: UIMachineEvent = { type: "HAND_CARD_CLICKED", cardIndex: index };
    send(event);
  }

  // Determine if the local player can interact with their hand
  const canInteract = isMyTurn && hasPendingCard;

  // Extract peekable cards for the local player if they exist
  const peekableCards = localPlayer.cardsToPeek?.map((card: Card) => {
    const handIndex = localPlayer.hand.findIndex(c => c.id === card.id);
    return { card, index: handIndex };
  }).filter(item => item.index !== -1) as { card: Card; index: number }[] | undefined;

  return (
    <div className="relative w-full">
      <div className="mb-4 flex items-end justify-center" style={{ minHeight: '130px' }}>
        <AnimatePresence>
          {isMyTurn && hasPendingCard && localPlayer.pendingDrawnCard && (
            <div className="absolute bottom-full mb-4 transform">
              <DeckCard card={localPlayer.pendingDrawnCard} />
            </div>
          )}
        </AnimatePresence>
      </div>

      <HandGrid
        cards={localPlayer.hand}
        onCardClick={handleCardClick}
        selectedCardId={selectedCardId}
        canInteract={canInteract}
        gamePhase={gameState.currentPhase}
        peekableCards={peekableCards}
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