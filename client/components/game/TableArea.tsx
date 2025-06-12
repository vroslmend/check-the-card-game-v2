'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameUIContext, type UIMachineSnapshot } from '@/context/GameUIContext';
import { type Card, TurnPhase, PlayerActionType } from 'shared-types';
import { DrawnCardArea } from './DrawnCardArea';
import { VisualCardStack } from '../cards/VisualCardStack';
import logger from '@/lib/logger';

export interface TableAreaProps {
  drawnCard?: Card;
}

const selectTableAreaProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId } = state.context;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;
  const isDrawPhase = isMyTurn && currentGameState?.turnPhase === TurnPhase.DRAW;
  
  return {
    deckSize: currentGameState?.deckSize ?? 0,
    discardPile: currentGameState?.discardPile ?? [],
    topDiscardCard: currentGameState?.discardPile && currentGameState.discardPile.length > 0 ? currentGameState.discardPile[currentGameState.discardPile.length - 1] : null,
    discardPileIsSealed: currentGameState?.discardPileIsSealed ?? false,
    canDrawFromDeck: isDrawPhase,
    canDrawFromDiscard: isDrawPhase && !currentGameState?.discardPileIsSealed,
  };
};

export const TableArea = ({ drawnCard }: TableAreaProps) => {
  const { send } = GameUIContext.useActorRef();
  const {
    deckSize,
    discardPile,
    topDiscardCard,
    discardPileIsSealed,
    canDrawFromDeck,
    canDrawFromDiscard,
  } = GameUIContext.useSelector(selectTableAreaProps);
  
  const handleDeckClick = () => {
    if (canDrawFromDeck) {
      logger.info('Player is drawing from deck');
      send({ type: PlayerActionType.DRAW_FROM_DECK });
    }
  }

  const handleDiscardClick = () => {
    if (canDrawFromDiscard) {
      logger.info('Player is drawing from discard');
      send({ type: PlayerActionType.DRAW_FROM_DISCARD });
    }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 rounded-lg bg-stone-50 dark:bg-zinc-800/50 shadow-inner">
      <div className="flex flex-row items-center justify-center gap-6 sm:gap-10 md:gap-16 lg:gap-20">
        {/* Deck */}
        <VisualCardStack 
          title="Deck" 
          count={deckSize} 
          faceDown 
          size="md"
          canInteract={canDrawFromDeck}
          onClick={handleDeckClick}
        />

        {/* Drawn Card Area - will appear between the piles */}
        <AnimatePresence>
          {drawnCard && (
            <motion.div
              layoutId={`drawn-card-${drawnCard.id}`}
              initial={{ opacity: 0, scale: 0.7, y: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <DrawnCardArea card={drawnCard} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discard Pile */}
        <VisualCardStack 
          title="Discard" 
          cards={discardPile} 
          count={discardPile.length} 
          topCard={topDiscardCard}
          isSealed={discardPileIsSealed}
          canInteract={canDrawFromDiscard}
          onClick={handleDiscardClick}
          size="md"
        />
      </div>
    </div>
  );
};