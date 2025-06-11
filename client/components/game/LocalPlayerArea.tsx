"use client"

import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { User, BadgeCheck } from 'lucide-react';
import { GameStage, TurnPhase, PlayerActionType } from 'shared-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DeckCard } from '@/components/cards/DeckCard';
import PlayerHand from './PlayerHand';

export const LocalPlayerArea = () => {
  const [state, send] = useUI();
  const { currentGameState, localPlayerId, abilityContext } = state.context;
  
  if (!currentGameState || !localPlayerId) {
    return null;
  }
  
  const localPlayer = currentGameState.players[localPlayerId];
  
  if (!localPlayer) {
    return null;
  }

  const { name, isReady, hand = [] } = localPlayer;
  const isCurrentTurn = currentGameState.currentPlayerId === localPlayerId;

  const handleCardClick = (cardIndex: number) => {
    if (abilityContext) {
      send({ type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', playerId: localPlayerId, cardIndex });
      return;
    }

    if (currentGameState.turnPhase === TurnPhase.MATCHING) {
      send({ type: 'ATTEMPT_MATCH', handCardIndex: cardIndex });
      return;
    }

    if (isCurrentTurn && currentGameState.turnPhase === TurnPhase.DISCARD) {
      send({ type: 'SWAP_AND_DISCARD', cardIndex });
      return;
    }
  };
  
  return (
    <div className="w-full max-w-3xl px-4">
      <div className="relative flex flex-col items-center">
        {/* Card area */}
        <div className="w-full relative">
          <div className="mx-auto flex items-center justify-center">
            <PlayerHand 
              player={localPlayer}
              isLocalPlayer={true}
              onCardClick={handleCardClick}
            />
          </div>
        </div>

        {/* Player info */}
        <div className="mt-4 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <User className="h-5 w-5" />
                </div>
                {isCurrentTurn && (
                  <motion.div
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-stone-900"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: [0.8, 1.2, 1] }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="font-medium px-2 py-0.5 bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                  You
                </Badge>
                <span className="font-medium text-stone-800 dark:text-stone-200">{name}</span>
                {isReady && (
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};