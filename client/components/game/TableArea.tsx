'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { GamePhase, PlayerActionType, SocketEventName } from 'shared-types';
import { useGameStore } from '@/store/gameStore';
import { DeckCard } from '@/components/cards/DeckCard';

export const TableArea = () => {
  const deckSize = useGameStore((state) => state.currentGameState?.deckSize ?? 0);
  const discardPile = useGameStore((state) => state.currentGameState?.discardPile ?? []);
  const gamePhase = useGameStore((state) => state.currentGameState?.currentPhase);
  const currentPlayerId = useGameStore((state) => state.currentGameState?.currentPlayerId);
  const gameId = useGameStore((state) => state.gameId);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const emit = useGameStore((state) => state.emit);

  const isCurrentPlayer = currentPlayerId === localPlayerId;
  const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  const canDrawFromDeck = isCurrentPlayer && gamePhase === 'playPhase';
  const canDrawFromDiscard = isCurrentPlayer && gamePhase === 'playPhase' && !!topDiscardCard;

  const handleDeckClick = () => {
    if (canDrawFromDeck && gameId && localPlayerId) {
      emit(SocketEventName.PLAYER_ACTION, {
        gameId,
        playerId: localPlayerId,
        type: PlayerActionType.DRAW_FROM_DECK,
      });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard && gameId && localPlayerId) {
      emit(SocketEventName.PLAYER_ACTION, {
        gameId,
        playerId: localPlayerId,
        type: PlayerActionType.DRAW_FROM_DISCARD,
      });
    }
  };

  const currentPlayerName = useGameStore((state) => {
    if (!state.currentGameState || !state.currentGameState.currentPlayerId) return 'Unknown Player';
    return state.currentGameState.players[state.currentGameState.currentPlayerId]?.name ?? '...';
  });

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
              {gamePhase?.replace(/([A-Z])/g, ' $1').trim() ?? 'Loading...'}
            </p>
          </Card>
        </motion.div>
      </CardContent>
    </Card>
  );
};