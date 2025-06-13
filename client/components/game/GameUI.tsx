'use client';

import React from 'react';
import { useUISelector } from '@/context/GameUIContext';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { RejoinModal } from '@/components/modals/RejoinModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameUI() {
  const state = useUISelector((s) => s);

  const renderContent = () => {
    if (state.matches('initializing')) {
      return <LoadingOrError message="Initializing Game..." />;
    }
    if (state.matches({ inGame: 'lobby' })) {
      return <GameLobby />;
    }
    if (state.hasTag('playing') || state.matches({ inGame: 'scoring' }) || state.matches({ inGame: 'gameover' })) {
      return <GameBoard />;
    }
    if (state.matches({ inGame: 'promptToJoin' })) {
      return <div className="w-full h-full bg-stone-900/10 backdrop-blur-sm" />;
    }
    return <LoadingOrError message="Connecting..." />;
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-stone-100 dark:bg-zinc-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={String(state.value)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      <RejoinModal />
    </main>
  );
}