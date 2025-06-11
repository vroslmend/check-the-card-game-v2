'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import GameClient from './GameClient';
import GameUI from '../../../components/game/GameUI';
import { ClientCheckGameState } from 'shared-types';
import logger from '@/lib/logger';

// Add CSS animation for spinner
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-spinner {
    animation: spin 1s linear infinite;
  }
`;

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [initialGameState, setInitialGameState] = useState<ClientCheckGameState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to get initial game state from session storage
    try {
      const startTime = performance.now();
      const persistedGameStateJSON = sessionStorage.getItem('initialGameState');
      if (persistedGameStateJSON) {
        const gameState = JSON.parse(persistedGameStateJSON);
        logger.info({ 
          gameId, 
          source: 'sessionStorage',
          loadTimeMs: Math.round(performance.now() - startTime)
        }, 'GamePage loaded initial state from session storage');
        setInitialGameState(gameState);
      } else {
        logger.info({ gameId }, 'No initial game state found in session storage');
      }
    } catch (e) {
      logger.error({ error: e }, 'Error retrieving game state from session storage');
    }
    setIsLoading(false);
  }, [gameId]);

  if (isLoading) {
    return (
      <>
        <style>{spinnerStyle}</style>
        <div className="flex flex-col h-screen items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-stone-200 dark:border-zinc-800 border-t-stone-900 dark:border-t-stone-100 loading-spinner mb-4"></div>
          <div>Loading game...</div>
        </div>
      </>
    );
  }

  return (
    <GameClient gameId={gameId} initialGameState={initialGameState}>
      <GameUI />
    </GameClient>
  );
}