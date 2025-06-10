'use client';

import React from 'react';
import { useUI } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from '@/components/ui/sonner';
import { GameStage } from 'shared-types';

function GameView() {
  const [state] = useUI();
  
  const isDisconnected = state.matches({ inGame: 'disconnected' });
  const inLobby = state.matches({ inGame: 'lobby' });
  const inGame = state.matches({ inGame: 'playing' });

  const content = () => {
    if (inLobby) {
      return <GameLobby />;
    }
    
    if (inGame) {
      return <GameBoard />;
    }

    // Default to a loading state if not in a specific, known UI state.
    // This covers initial loading, re-connections, etc.
    return <LoadingOrError message="Initializing..." />;
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
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden">
        {content()}
      </main>
      <Toaster richColors />
    </>
  );
}

export default function GamePage() {
  return <GameView />;
}