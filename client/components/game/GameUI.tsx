'use client';

import React, { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { RejoinModal } from '@/components/modals/RejoinModal';
import { motion, AnimatePresence } from 'framer-motion';

// Selectors to determine the current view based on the machine's state
const selectIsLoading = (state: UIMachineSnapshot) => state.matches('initializing');
const selectIsInLobby = (state: UIMachineSnapshot) => state.matches({ inGame: 'lobby' });
const selectIsPlaying = (state: UIMachineSnapshot) => state.hasTag('playing');
const selectIsGameOver = (state: UIMachineSnapshot) => state.matches({ inGame: 'gameover' }) || state.matches({ inGame: 'scoring' });

export default function GameUI() {
  const { actorRef } = useContext(UIContext)!;

  // Use the selectors to get boolean flags
  const isLoading = useSelector(actorRef, selectIsLoading);
  const isInLobby = useSelector(actorRef, selectIsInLobby);
  const isPlaying = useSelector(actorRef, selectIsPlaying);
  const isGameOver = useSelector(actorRef, selectIsGameOver);

  if (isLoading) {
    return <LoadingOrError message="Initializing Game..." />;
  }
  
  // The main content of the page is now determined by these simple checks.
  // The RejoinModal will appear on top of this content when its state is active.
  const mainContent = () => {
    if (isInLobby) return <GameLobby />;
    if (isPlaying || isGameOver) return <GameBoard />; // GameBoard can handle scoring/gameover views
    return <LoadingOrError message="Connecting..." />; // Default fallback
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-100 dark:bg-stone-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={isLoading ? 'loading' : 'content'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          {mainContent()}
        </motion.div>
      </AnimatePresence>

      {/* RejoinModal is always mounted and decides its own visibility based on machine state */}
      <RejoinModal />
    </main>
  );
}