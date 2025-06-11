'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TableArea } from './TableArea';
import { OpponentArea } from './OpponentArea';
import { GameActionControls } from './GameActionControls';
import { LocalPlayerArea } from './LocalPlayerArea';
import { PlayingCard } from '../cards/PlayingCard';
import { toast } from 'sonner';
import { GameStage } from 'shared-types';

export function GameBoard() {
  const [state, send] = useUI();
  const { currentGameState: gameState, localPlayerId } = state.context;
  const isDisconnected = state.tags.has('disconnected');
  const isInitialPeek = gameState?.gameStage === GameStage.INITIAL_PEEK;

  if (isDisconnected) {
    toast.error('You are disconnected. Attempting to reconnect...');
  }

  // Early return for missing data
  if (!gameState || !localPlayerId) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-stone-100 dark:bg-stone-900">
        <div className="flex flex-col items-center text-stone-600 dark:text-stone-400">
          <Loader className="h-8 w-8 animate-spin mb-4" />
          <p>Loading game data...</p>
        </div>
      </div>
    );
  }

  const localPlayer = gameState.players[localPlayerId];
  const handleReadyForPeek = () => {
    send({ type: 'DECLARE_READY_FOR_PEEK_CLICKED' });
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-stone-100 dark:bg-stone-900">
      {/* Connection status alert */}
      <AnimatePresence>
        {isDisconnected && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
          >
            <Alert variant="destructive" className="bg-red-100 dark:bg-red-900/30">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4" />
                <AlertTitle>Connection Lost</AlertTitle>
              </div>
              <AlertDescription className="mt-1">
                You're disconnected from the game server. Attempting to reconnect...
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game warning for invalid state */}
      {gameState && (!gameState.players || Object.keys(gameState.players).length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-40">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Game State Error</AlertTitle>
            <AlertDescription>
              There was a problem loading the game state. Please refresh the page.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Initial Peek Instructions Overlay - only appears during initial peek and doesn't block the game view */}
      <AnimatePresence>
        {isInitialPeek && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="p-4 bg-stone-800/80 backdrop-blur-sm rounded-lg text-white mb-4"
            >
              <h2 className="text-xl font-medium mb-2">Initial Peek</h2>
              <p className="text-sm text-stone-300">
                Look at your <span className="font-semibold text-yellow-300">bottom two cards</span> and memorize them before the game starts.
              </p>
            </motion.div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReadyForPeek}
              className="px-6 py-3 w-full bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold shadow-lg"
            >
              {localPlayer?.isReady ? "Waiting for others..." : "I'm Ready"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game content */}
      <div className="flex flex-col h-full">
        {/* Game layout grid */}
        <div className="grid grid-rows-[1fr_auto_1fr] h-full py-2">
          {/* Opponents area - top section */}
          <div className="w-full flex items-center justify-center">
            <OpponentArea />
          </div>

          {/* Middle game area */}
          <div className="w-full my-4 max-h-[40vh]">
            <TableArea />
          </div>

          {/* Local player area - bottom section */}
          <div className="w-full flex items-end justify-center pb-6">
            <LocalPlayerArea />
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-auto pb-4 px-4">
          <GameActionControls />
        </div>
      </div>
    </div>
  );
}