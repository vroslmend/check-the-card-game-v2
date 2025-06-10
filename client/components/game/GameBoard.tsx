'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TableArea } from './TableArea';
import { OpponentArea } from './OpponentArea';
import { GameActionControls } from './GameActionControls';
import { LocalPlayerArea } from './LocalPlayerArea';
import { toast } from 'sonner';

export function GameBoard() {
  const [state] = useUI();
  const { currentGameState: gameState, localPlayerId } = state.context;
  const isDisconnected = state.tags.has('disconnected');

  if (isDisconnected) {
    toast.error('You are disconnected. Attempting to reconnect...');
  }

  // Early return for missing data
  if (!gameState || !localPlayerId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-100 dark:bg-stone-900">
        <div className="flex flex-col items-center text-stone-600 dark:text-stone-400">
          <Loader className="h-8 w-8 animate-spin mb-4" />
          <p>Loading game data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-stone-100 dark:bg-stone-900">
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

      {/* Game content */}
      <div className="flex-1 grid grid-rows-[1fr,auto] gap-4 p-4">
        {/* Game area */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Other players */}
          <OpponentArea />

          {/* Middle game area */}
          <div className="my-8 w-full">
            <TableArea />
          </div>

          {/* Local player */}
          <div className="w-full mt-auto">
            <LocalPlayerArea />
          </div>
        </div>

        {/* Action bar */}
        <GameActionControls />
      </div>
    </div>
  );
}