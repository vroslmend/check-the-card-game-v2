'use client';

import React from 'react';
import { useUI } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from '@/components/ui/sonner';
import { GameStage } from 'shared-types';
import { motion, AnimatePresence } from 'framer-motion';

function GameView() {
  const [state] = useUI();
  
  // Check state using state.matches for robustness with nested states
  const isDisconnected = state.tags.has('disconnected');
  const inLobby = state.matches({ inGame: 'lobby' });
  const inGame = state.matches({ inGame: 'playing' });
  const gameStage = state.context.currentGameState?.gameStage;

  // Generate a unique key for the AnimatePresence
  const getContentKey = () => {
    if (isDisconnected) return 'disconnected';
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
    <>
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
            {inLobby ? (
              <GameLobby />
            ) : inGame ? (
              <GameBoard />
            ) : (
              <LoadingOrError message="Initializing..." />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster richColors position="top-center" />
    </>
  );
}

export default function GamePage() {
  return <GameView />;
}