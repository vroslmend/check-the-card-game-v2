"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useUI } from "@/components/providers/UIMachineProvider"
import { DeckCard } from "../cards/DeckCard"
import { TurnPhase, PlayerActionType } from "shared-types"
import type { Card } from "shared-types"
import { Info, User } from "lucide-react"
import PlayerHand from "./PlayerHand"

export function LocalPlayerArea() {
  const [state, send] = useUI()
  const { currentGameState: gameState, localPlayerId, abilityContext } = state.context;

  if (!gameState || !localPlayerId || !gameState.players) return null;

  const localPlayer = gameState.players[localPlayerId];
  if (!localPlayer) return null;

  const isMyTurn = gameState.currentPlayerId === localPlayerId;
  const pendingCard = localPlayer.pendingDrawnCard;
  const hasPendingCard = !!pendingCard && !('facedown' in pendingCard);

  const isAbilityPlayer = abilityContext?.playerId === localPlayerId;
  const isAbilityActive = state.matches({ inGame: { playing: 'ability' } }) && isAbilityPlayer;
  const canInteractWithHand = (isMyTurn && gameState.turnPhase === TurnPhase.DISCARD) || isAbilityActive;

  const handleCardClick = (index: number) => {
    if (isAbilityActive) {
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: localPlayerId, cardIndex: index });
    } else if (isMyTurn && gameState.turnPhase === TurnPhase.DISCARD) {
      send({ type: 'PLAY_CARD', cardIndex: index });
    }
  };

  const getSelectedIndex = () => {
    if (!abilityContext) return null;
    if (abilityContext.stage === 'swapping') {
      const target = abilityContext.selectedSwapTargets.find(t => t.playerId === localPlayerId);
      return target ? target.cardIndex : null;
    }
    return null;
  }
  
  const selectedIndex = getSelectedIndex();

  return (
    <motion.div 
      className="relative w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4 flex items-end justify-center h-40 relative">
        <AnimatePresence>
          {isMyTurn && hasPendingCard && pendingCard && (
            <motion.div 
              className="absolute z-20 transform"
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="relative">
                <motion.div 
                  className="absolute -top-12 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>You drew a card!</span>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-stone-900 dark:bg-stone-100 rotate-45" />
                </motion.div>
                
                <DeckCard 
                  card={pendingCard as Card} 
                  isInteractive={true}
                  onClick={() => {
                    if (isMyTurn && gameState.turnPhase === TurnPhase.DISCARD) {
                      // Use PLAYER_ACTION with the correct payload
                      send({ 
                        type: 'PLAYER_ACTION', 
                        payload: { 
                          type: PlayerActionType.DISCARD_DRAWN_CARD, 
                          payload: { playerId: localPlayerId } 
                        } 
                      });
                    }
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Player area with background */}
      <motion.div 
        className="relative rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100/30 to-white/10 dark:from-zinc-900/30 dark:to-zinc-950/10 backdrop-blur-sm border border-stone-200/30 dark:border-zinc-800/30 rounded-2xl" />
        
        <div className="relative px-6 py-8">
          <PlayerHand
            player={localPlayer}
            localPlayerId={localPlayerId}
            canInteract={canInteractWithHand}
            onCardClick={handleCardClick}
            selectedCardIndex={selectedIndex}
          />
          
          <motion.div 
            className="absolute bottom-2 right-2 flex items-center gap-2 bg-stone-100 dark:bg-zinc-900 rounded-full px-3 py-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-full">
              <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-light text-stone-700 dark:text-stone-300">{localPlayer.name}</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}