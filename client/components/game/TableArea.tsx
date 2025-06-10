'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { DeckCard } from '@/components/cards/DeckCard';
import { TurnPhase, CardRank, PlayerActionType } from 'shared-types';

export const TableArea = () => {
  const [state, send] = useUI();

  const { currentGameState, localPlayerId } = state.context;
  const { deckSize = 0, discardPile = [], turnPhase, currentPlayerId, players } = currentGameState ?? {};

  const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isMyTurn = currentPlayerId === localPlayerId;

  const canDrawFromDeck = isMyTurn && turnPhase === TurnPhase.DRAW;
  
  const isDiscardDrawable = topDiscardCard && !new Set([CardRank.King, CardRank.Queen, CardRank.Jack]).has(topDiscardCard.rank);
  const canDrawFromDiscard = isMyTurn && turnPhase === TurnPhase.DRAW && isDiscardDrawable;

  const handleDeckClick = () => {
    if (canDrawFromDeck) {
      send({ type: 'DRAW_CARD' });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard && localPlayerId) {
      send({ type: 'PLAYER_ACTION', payload: { type: PlayerActionType.DRAW_FROM_DISCARD, payload: { playerId: localPlayerId } } });
    }
  };

  const currentPlayerName = players && currentPlayerId ? players[currentPlayerId]?.name : '...';

  const getPhaseText = () => {
    if (!turnPhase || !players) return 'Waiting...';
    switch (turnPhase) {
      case TurnPhase.DRAW: return 'Draw Phase';
      case TurnPhase.ACTION: return 'Action Phase';
      case TurnPhase.DISCARD: return 'Discard Phase';
      default: return 'Loading...';
    }
  }

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
              {getPhaseText()}
            </p>
          </Card>
        </motion.div>
      </CardContent>
    </Card>
  );
};