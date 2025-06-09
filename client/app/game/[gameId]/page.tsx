'use client';

import React, { useEffect } from 'react';

import { useUI } from '@/components/providers/uiMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from '@/components/ui/sonner';
import InitialPeek from '@/components/game/InitialPeek';

import type { GamePhase } from 'shared-types';

export default function GamePage() {
  const [state, send] = useUI();

  const isDisconnected = state.matches({ socket: 'disconnected' });

  // Use the machine's state to determine what to render.
  // This is much cleaner and less prone to duplication.
  const content = () => {
    if (state.matches({ game: 'uninitialized' }) || state.matches({ game: 'loading' })) {
      return <LoadingOrError message="Initializing game..." />;
    }
    if (state.matches({ game: 'lobby' })) {
      return <GameLobby />;
    }
    if (state.matches({ game: 'initialPeek' })) {
      return <InitialPeek />;
    }
    if (
      state.matches({ game: 'playing' }) ||
      state.matches({ game: 'matching' }) ||
      state.matches({ game: 'abilityResolution' }) ||
      state.matches({ game: 'gameOver' })
    ) {
      return <GameBoard />;
    }
    // Fallback loading state
    return <LoadingOrError message="Entering a new game phase..." />;
  };

  if (isDisconnected) {
    return (
      <LoadingOrError
        isError={true}
        message="You have been disconnected from the server. Please refresh to reconnect."
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