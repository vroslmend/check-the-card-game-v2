'use client';

import React, { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { JoinGamePrompt } from '@/components/game/JoinGamePrompt';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '@/lib/logger';

const selectGameViewProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gs } = state.context;
  const isDisconnected = state.tags.has('disconnected');
  const outOfGame = state.matches('outOfGame');
  const inLobby = state.matches({ inGame: 'lobby' });
  const inGame = state.matches({ inGame: 'playing' });
  const gameStage = gs?.gameStage;
  
  return {
    isDisconnected,
    outOfGame,
    inLobby,
    inGame,
    gameStage
  };
};

export default function GameUI() {
  const { actorRef } = useContext(UIContext)!;
  const { 
    isDisconnected, 
    outOfGame, 
    inLobby, 
    inGame, 
    gameStage
  } = useSelector(actorRef, selectGameViewProps);
  
  logger.debug({
    isDisconnected,
    outOfGame,
    inLobby,
    inGame,
    gameStage
  }, 'GameUI component state');
  
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
    </main>
  );
} 