'use client';

import React, { use } from 'react';
import { useUI } from '@/components/providers/UIMachineProvider';
import { GameBoard } from '@/components/game/GameBoard';
import { GameLobby } from '@/components/game/GameLobby';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from '@/components/ui/sonner';
import { GameStage } from 'shared-types';

function GameView() {
  const [state] = useUI();
  // Safely access currentGameState. It might not exist on the initial render
  // or during certain machine transitions.
  const currentGameState = state.context?.currentGameState;

  // The socket connection is managed by the machine, but a top-level
  // check for a disconnected state is still useful for a banner/overlay.
  // The machine will automatically attempt to reconnect.
  const isDisconnected = state.tags?.has('disconnected');

  // Use the machine's state to determine what to render.
  const content = () => {
    // If we don't have a game state yet, we're loading.
    if (!currentGameState) {
      return <LoadingOrError message="Initializing game..." />;
    }

    const { gameStage } = currentGameState;

    // Show lobby while waiting for players or dealing cards
    if (gameStage === GameStage.WAITING_FOR_PLAYERS || gameStage === GameStage.DEALING) {
      return <GameLobby />;
    }
    
    // All other active stages render the main board.
    if (state.matches('inGame')) {
      return <GameBoard />;
    }

    // Fallback for any other state is a generic loading screen.
    return <LoadingOrError message="Loading..." />;
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