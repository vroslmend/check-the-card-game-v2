"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { PlayerActionType, TurnPhase, type PlayerId } from 'shared-types';
import logger from '@/lib/logger';
import PlayerHand from './PlayerHand';
import { UserCheck, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActionController } from './ActionController';

const selectLocalPlayerProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId, currentAbilityContext } = state.context;
  const isPlayerTurn = currentGameState?.currentPlayerId === localPlayerId;
  const turnPhase = currentGameState?.turnPhase;
  const isChoosingSwapTarget = turnPhase === TurnPhase.DISCARD && isPlayerTurn;
  
  return {
    localPlayer: localPlayerId ? currentGameState?.players[localPlayerId] : null,
    isCurrentTurn: currentGameState?.currentPlayerId === localPlayerId,
    turnPhase: currentGameState?.turnPhase,
    abilityContext: currentAbilityContext,
    localPlayerId,
    isChoosingSwapTarget,
  };
};

export const LocalPlayerArea = () => {
  const { localPlayer, isCurrentTurn, turnPhase, abilityContext, localPlayerId, isChoosingSwapTarget } = useUISelector(selectLocalPlayerProps);
  const { send } = useUIActorRef();

  const { selectedCardIndex, setSelectedCardIndex } = useActionController();

  if (!localPlayer || !localPlayerId) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="font-serif text-stone-500">Waiting for player...</p>
      </div>
    );
  }

  const handleCardClick = (cardIndex: number) => {
    if (abilityContext) {
      logger.debug({ cardIndex, abilityContext }, 'Card clicked for ability');
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: localPlayerId, cardIndex });
      return;
    }

    if (isChoosingSwapTarget) {
      logger.debug({ cardIndex }, 'Card clicked for swap and discard');
      send({ type: PlayerActionType.SWAP_AND_DISCARD, payload: { handCardIndex: cardIndex } });
      return;
    }

    if (turnPhase === TurnPhase.MATCHING) {
      logger.debug({ cardIndex }, 'Card clicked for match attempt - setting selected card');
      setSelectedCardIndex(cardIndex);
      return;
    }

    logger.warn({ cardIndex, turnPhase, isMyTurn: isCurrentTurn }, 'Card click had no effect');
  };

  const promptText = isChoosingSwapTarget ? "Select a card from your hand to swap" : null;

  return (
    <motion.div 
      layout 
      className="relative w-full h-full flex flex-col justify-end p-3 sm:p-6 pb-8 sm:pb-10 glass rounded-lg shadow-inner overflow-y-auto"
    >
      {/* Player Hand Area */}
      <div className="flex-grow flex flex-col items-center justify-center w-full">
        <PlayerHand 
          player={localPlayer}
          isLocalPlayer={true}
          onCardClick={handleCardClick}
          className="w-full max-w-md lg:max-w-lg xl:max-w-xl"
          selectedCardIndex={selectedCardIndex}
        />
        <AnimatePresence>
          {promptText && (
            <motion.div
              className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown className="w-3 h-3" />
              {promptText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Player Info Bar at bottom */}
      <motion.div
        layout="position"
        className={cn(
          "relative mt-4 w-full max-w-xs mx-auto px-4 py-2 rounded-lg border",
          "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm",
          isCurrentTurn 
            ? "border-emerald-500/50"
            : "border-stone-200 dark:border-zinc-700/50"
        )}
      >
        <AnimatePresence>
          {isCurrentTurn && (
            <motion.div
              className="absolute -top-px -left-px -right-px h-0.5 bg-emerald-500"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ originX: 0.5 }}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              isCurrentTurn 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                : "bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400"
            )}>
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">{localPlayer.name}</span>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                {isCurrentTurn ? 
                  <span className="text-emerald-600 dark:text-emerald-400">Your Turn</span> : 
                  "Waiting..."}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};