'use client';

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { UIMachineProvider } from '@/components/providers/uiMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';

export default function GameClient({
  children,
  gameId,
}: {
  children: React.ReactNode;
  gameId: string;
}) {
  const [localPlayerId] = useLocalStorage<string | null>('localPlayerId', null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
    <UIMachineProvider gameId={gameId} localPlayerId={localPlayerId}>
      {children}
    </UIMachineProvider>
  );
} 