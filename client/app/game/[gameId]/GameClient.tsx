'use client';

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { UIMachineProvider } from '@/components/providers/UIMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { RejoinModal } from '@/components/modals/RejoinModal'
import { ClientCheckGameState } from 'shared-types';
import logger from '@/lib/logger';

export default function GameClient({
  gameId,
  initialGameState,
  children,
}: {
  gameId: string;
  initialGameState?: ClientCheckGameState;
  children: React.ReactNode;
}) {
  const [localPlayerId, setLocalPlayerId] = useLocalStorage<string | null>(`player-id-${gameId}`, null);
  const [sessionGameState, setSessionGameState] = useState<ClientCheckGameState | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    
    // Check for session data
    try {
      // Try to get player ID and game state from session
      const persistedPlayerSessionJSON = sessionStorage.getItem('playerSession');
      const persistedGameStateJSON = sessionStorage.getItem('initialGameState');
      
      if (persistedPlayerSessionJSON) {
        const session = JSON.parse(persistedPlayerSessionJSON);
        if (session.gameId === gameId) {
          logger.info({ gameId, playerId: session.playerId }, 'Found matching player session');
          setLocalPlayerId(session.playerId);
        }
      }
      
      if (persistedGameStateJSON) {
        logger.info({ gameId }, 'Found persisted game state, loading directly');
        const gameState = JSON.parse(persistedGameStateJSON);
        setSessionGameState(gameState);
        
        // We don't want to remove initialGameState from storage here anymore
        // since we'll directly pass it to the machine
      }
    } catch (e) {
      logger.error({ error: e }, 'Error retrieving session data');
    }
    
    setIsLoading(false);
  }, [gameId, setLocalPlayerId]);

  if (!isClient || isLoading) {
    return <LoadingOrError message="Initializing game..." />;
  }

  // Use either the provided initialGameState, the one from session storage, or undefined
  const effectiveGameState = initialGameState || sessionGameState;

  logger.info(
    { 
      hasInitialState: !!effectiveGameState, 
      hasPlayerId: !!localPlayerId 
    }, 
    'Initializing UIMachineProvider'
  );

  return (
    <UIMachineProvider 
      gameId={gameId} 
      localPlayerId={localPlayerId} 
      initialGameState={effectiveGameState}
    >
      <RejoinModal />
      {children}
    </UIMachineProvider>
  );
} 