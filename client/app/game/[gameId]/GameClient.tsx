'use client';

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { UIMachineProvider } from '@/components/providers/UIMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from "@/components/ui/sonner"
import { RejoinModal } from '@/components/modals/RejoinModal'
import { ClientCheckGameState } from 'shared-types';

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
  const [initialGameState, setInitialGameState] = useState<ClientCheckGameState | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedStateJSON = sessionStorage.getItem('initialGameState');
    if (savedStateJSON) {
      const savedState = JSON.parse(savedStateJSON);
      setInitialGameState(savedState);
      // Clean up the session storage after using it for initialization.
      sessionStorage.removeItem('initialGameState');
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
      <UIMachineProvider gameId={gameId} localPlayerId={localPlayerId} initialGameState={initialGameState}>
        {children}
        <RejoinModal />
      </UIMachineProvider>
      <Toaster />
    </>
  );
} 