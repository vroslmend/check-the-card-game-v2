'use client';

import React, { useState, useEffect } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { UIMachineProvider } from '@/components/providers/UIMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';
import { Toaster } from "@/components/ui/sonner"
import { RejoinModal } from '@/components/modals/RejoinModal'
import { ClientCheckGameState } from 'shared-types';

export default function GameClient({
  gameId,
  initialGameState,
}: {
  gameId: string;
  initialGameState?: ClientCheckGameState;
}) {
  const [localPlayerId, setLocalPlayerId] = useLocalStorage<string | null>(`player-id-${gameId}`, null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Attempt to retrieve localPlayerId from localStorage when the component mounts on the client
    const storedPlayerId = localStorage.getItem(`player-id-${gameId}`);
    if (storedPlayerId) {
      setLocalPlayerId(JSON.parse(storedPlayerId));
    }
  }, []);

  if (!isClient) {
    // Render a loading state or nothing on the server
    return <LoadingOrError message="Initializing game..." />;
  }

  return (
    <>
      <UIMachineProvider gameId={gameId} localPlayerId={localPlayerId} initialGameState={initialGameState}>
        <RejoinModal />
        {/* GameView will be the main component consuming the context */}
      </UIMachineProvider>
      <Toaster />
    </>
  );
} 