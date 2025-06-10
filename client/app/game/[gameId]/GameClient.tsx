'use client';

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { UIMachineProvider } from '@/components/providers/UIMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { SnapshotFrom } from 'xstate';
import { uiMachine } from '@/machines/uiMachine';
import { Toaster } from "@/components/ui/sonner"
import { RejoinModal } from '@/components/modals/RejoinModal'
import { GameBoard } from '@/components/game/GameBoard'

export default function GameClient({
  children,
  gameId,
}: {
  children: React.ReactNode;
  gameId: string;
}) {
  const [localPlayerId] = useLocalStorage<string | null>(
    "localPlayerId",
    null,
    {
      serializer: v => (v === null ? "%%NULL%%" : v),
      deserializer: v => (v === "%%NULL%%" ? null : v),
    },
  );
  const [isClient, setIsClient] = useState(false);
  const [initialState, setInitialState] = useState<SnapshotFrom<typeof uiMachine> | null>(null);

  useEffect(() => {
    setIsClient(true);
    // On the first client-side render, try to retrieve the initial state.
    const persistedStateJSON = sessionStorage.getItem('initialGameState');
    if (persistedStateJSON) {
      try {
        const persistedState = JSON.parse(persistedStateJSON);
        setInitialState(persistedState);
        // Clean up the storage immediately after use.
        sessionStorage.removeItem('initialGameState');
      } catch (e) {
        console.error("Failed to parse persisted state:", e);
        sessionStorage.removeItem('initialGameState');
      }
    }
  }, []);

  if (!isClient) {
    // Render a placeholder on the server and during the initial client-side render
    // to prevent a hydration mismatch.
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden">
        <LoadingOrError message="Initializing..." />
      </main>
    );
  }

  if (!gameId || !localPlayerId) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden">
        <LoadingOrError message="Loading game session..." />
      </main>
    );
  }

  return (
    <>
      <UIMachineProvider gameId={gameId} localPlayerId={localPlayerId} initialState={initialState}>
        <GameBoard />
        <RejoinModal />
      </UIMachineProvider>
      <Toaster />
    </>
  );
} 