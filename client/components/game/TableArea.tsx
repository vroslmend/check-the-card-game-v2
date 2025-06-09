'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/uiMachineProvider';
import { DeckCard } from '@/components/cards/DeckCard';

export const TableArea = () => {
  const [state, send] = useUI();

  const { currentGameState, localPlayerId } = state.context;
  const { deckSize = 0, discardPile = [], currentPhase, currentPlayerId, players } = currentGameState ?? {};

  const isCurrentPlayer = currentPlayerId === localPlayerId;
  const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  const canDrawFromDeck = isCurrentPlayer && currentPhase === 'playPhase';
  const canDrawFromDiscard = isCurrentPlayer && currentPhase === 'playPhase' && !!topDiscardCard;

  const handleDeckClick = () => {
    if (canDrawFromDeck) {
      send({ type: 'DRAW_FROM_DECK_CLICKED' });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard) {
      send({ type: 'DRAW_FROM_DISCARD_CLICKED' });
    }
  };

  const currentPlayerName = players && currentPlayerId ? players[currentPlayerId]?.name : '...';

  return (
    <Card className="h-full bg-card/50">
      <CardContent className="relative flex h-full items-center justify-center gap-8 p-4">
        {/* Deck */}
        <div
          onClick={handleDeckClick}
          className={`transition-transform duration-200 ${canDrawFromDeck ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
        >
          <DeckCard count={deckSize} />
        </div>

        {/* Discard Pile */}
        <div
          onClick={handleDiscardClick}
          className={`transition-transform duration-200 ${canDrawFromDiscard ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
        >
          <DeckCard card={topDiscardCard} />
        </div>

        {/* Game Phase / Status Indicator */}
        <motion.div
          layoutId="activePlayerIndicator"
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        >
          <Card className="px-4 py-2 text-sm text-center shadow-lg">
            <p>
              It's <span className="font-bold">{currentPlayerName}'s</span> turn
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {currentPhase?.replace(/([A-Z])/g, ' $1').trim() ?? 'Loading...'}
            </p>
          </Card>
        </motion.div>
      </CardContent>
    </Card>
  );
};