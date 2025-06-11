"use client"

import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { User, BadgeCheck } from 'lucide-react';
import { GameStage, TurnPhase, PlayerActionType } from 'shared-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DeckCard } from '@/components/cards/DeckCard';

export const LocalPlayerArea = () => {
  const [state, send] = useUI();
  const { currentGameState, localPlayerId, visibleCards } = state.context;
  const isInitialPeek = currentGameState?.gameStage === GameStage.INITIAL_PEEK;
  
  if (!currentGameState || !localPlayerId) {
    return null;
  }
  
  const localPlayer = currentGameState.players[localPlayerId];
  const { name, isReady, hand = [] } = localPlayer || {};
  const isCurrentTurn = currentGameState.currentPlayerId === localPlayerId;
  const isDiscardPhase = currentGameState.turnPhase === TurnPhase.DISCARD;
  const isActionPhase = currentGameState.turnPhase === TurnPhase.ACTION;

  const canInteractWithCard = (cardIndex: number) => {
    // During initial peek, only the bottom two cards are interactive
    if (isInitialPeek) {
      return cardIndex >= hand.length - 2;
    }
    
    // During normal play
    if (isCurrentTurn && isActionPhase) {
      return true; // All cards are interactive during action phase
    }
    
    if (isCurrentTurn && isDiscardPhase) {
      return true; // Can select a card to discard
    }
    
    return false;
  };

  const handleCardClick = (cardIndex: number) => {
    if (!canInteractWithCard(cardIndex)) return;
    
    if (isInitialPeek) {
      // For initial peek, we use the ready declaration since there's no peek action
      if (!isReady) {
        send({ 
          type: 'PLAYER_ACTION', 
          payload: { 
            type: PlayerActionType.DECLARE_READY_FOR_PEEK,
            payload: { playerId: localPlayerId }
          } 
        });
      }
      return;
    }
    
    // During normal play
    if (isCurrentTurn && (isActionPhase || isDiscardPhase)) {
      // Select the card using an existing event
      send({ type: 'PLAY_CARD', cardIndex });
    }
  };

  const isCardHighlighted = (cardIndex: number) => {
    // Check if this card is in the current ability context selection
    if (state.context.abilityContext) {
      const target = state.context.abilityContext.selectedSwapTargets?.find(
        t => t.playerId === localPlayerId && t.cardIndex === cardIndex
      );
      return !!target;
    }
    return false;
  };

  const isCardPeeking = (cardIndex: number) => {
    // Check if this card is currently being peeked at
    return visibleCards.some(
      vc => vc.playerId === localPlayerId && vc.cardIndex === cardIndex
    );
  };

  // Determine if this card should have a special highlight during initial peek phase
  const shouldHighlightForInitialPeek = (cardIndex: number) => {
    return isInitialPeek && cardIndex >= hand.length - 2;
  };

  return (
    <div className="w-full max-w-3xl px-4">
      <div className="relative flex flex-col items-center">
        {/* Card area */}
        <div className="w-full relative">
          <div className="mx-auto flex items-center justify-center">
            <motion.div 
              className="flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {hand.map((card, index) => (
                <div 
                  key={`${index}-${isCardPeeking(index) ? 'peek' : 'normal'}`} 
                  className="relative"
                  style={{ 
                    marginLeft: index === 0 ? 0 : '-2.5rem',
                    zIndex: isCardHighlighted(index) ? 10 : hand.length - index
                  }}
                >
                  <DeckCard 
                    card={card}
                    isInteractive={canInteractWithCard(index)}
                    onClick={() => handleCardClick(index)}
                    className={cn(
                      shouldHighlightForInitialPeek(index) && "ring-4 ring-yellow-400/50 dark:ring-yellow-500/30",
                      shouldHighlightForInitialPeek(index) && isCardPeeking(index) && "ring-yellow-400 dark:ring-yellow-500"
                    )}
                  />
                  {/* Indicator for bottom two cards during initial peek */}
                  {shouldHighlightForInitialPeek(index) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: 1, 
                        scale: [0.9, 1.1, 1],
                        y: [0, -5, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse" 
                      }}
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-yellow-500 dark:text-yellow-400 
                                bg-yellow-100 dark:bg-yellow-900/40 px-2 py-0.5 rounded-full backdrop-blur-sm
                                border border-yellow-200 dark:border-yellow-800/50 shadow-sm"
                    >
                      Peek me
                    </motion.div>
                  )}
                </div>
              ))}
            </motion.div>
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