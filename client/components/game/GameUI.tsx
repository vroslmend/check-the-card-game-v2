'use client';

import React, { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { JoinGamePrompt } from '@/components/game/JoinGamePrompt';
import { DrawnCardArea } from '@/components/game/DrawnCardArea';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '@/lib/logger';

const selectGameViewProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gs, localPlayerId } = state.context;
  const isDisconnected = state.tags.has('disconnected');
  const outOfGame = state.matches('outOfGame');
  const inLobby = state.matches({ inGame: 'lobby' });
  const inGame = state.matches({ inGame: 'playing' });
  const gameStage = gs?.gameStage;

  const localPlayer = localPlayerId ? gs?.players[localPlayerId] : null;
  const pendingDrawnCard = localPlayer?.pendingDrawnCard;
  
  // The card to show is the card object itself. The server redacts it for other players.
  const cardToShow = pendingDrawnCard && 'suit' in pendingDrawnCard ? pendingDrawnCard : null;
  // We can only discard a card that was drawn from the deck, not the discard pile
  const wasDrawnFromDeck = pendingDrawnCard && 'source' in pendingDrawnCard && pendingDrawnCard.source === 'deck';
  
  return {
    isDisconnected,
    outOfGame,
    inLobby,
    inGame,
    gameStage,
    cardToShow,
    wasDrawnFromDeck,
  };
};

export default function GameUI() {
  const { actorRef } = useContext(UIContext)!;
  const { 
    isDisconnected, 
    outOfGame, 
    inLobby, 
    inGame, 
    gameStage,
    cardToShow,
    wasDrawnFromDeck 
  } = useSelector(actorRef, selectGameViewProps);
  
  logger.debug({
    isDisconnected,
    outOfGame,
    inLobby,
    inGame,
    gameStage,
    hasDrawnCard: !!cardToShow
  }, 'GameUI component state');

  const handleSwap = () => {
    actorRef.send({ type: 'CHOOSE_SWAP_TARGET' });
  };

  const handleDiscard = () => {
    actorRef.send({ type: 'DISCARD_DRAWN_CARD' });
  };
  
  // Generate a unique key for the AnimatePresence
  const getContentKey = () => {
    if (isDisconnected) return 'disconnected';
    if (outOfGame) return 'join-prompt';
    if (inLobby) return 'lobby';
    if (inGame) return `game-${gameStage}`;
    return 'loading';
  };

  if (isDisconnected) {
    return (
      <LoadingOrError
        isError={true}
        message="You have been disconnected. Attempting to reconnect..."
      />
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-100 dark:bg-stone-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={getContentKey()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          {outOfGame ? (
            <JoinGamePrompt />
          ) : inLobby ? (
            <GameLobby />
          ) : inGame ? (
            <GameBoard />
          ) : (
            <LoadingOrError message="Initializing..." />
          )}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {cardToShow && (
          <DrawnCardArea 
            card={cardToShow}
            onSwap={handleSwap}
            onDiscard={handleDiscard}
            canDiscard={!!wasDrawnFromDeck}
          />
        )}
      </AnimatePresence>
    </main>
  );
} 