'use client';

import React, { useContext, useEffect } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import LoadingOrError from '@/components/layout/LoadingOrError';
import GameUI from '@/components/game/GameUI';
import { RejoinModal } from '@/components/modals/RejoinModal';

const selectIsReadyForGame = (state: UIMachineSnapshot) => 
  !state.matches('initializing') && !state.matches('outOfGame');

export default function GameClient({
  gameId,
}: {
  gameId: string;
  // No 'children' prop here
}) {
  const { actorRef } = useContext(UIContext)!;

  useEffect(() => {
    const snapshot = actorRef.getSnapshot();
    if (snapshot.context.gameId !== gameId) {
        actorRef.send({ 
            type: 'HYDRATE_GAME_STATE', 
            gameState: { gameId } as any 
        });
    }
  }, [gameId, actorRef]);

  const isReady = useSelector(actorRef, selectIsReadyForGame);

  if (!isReady) {
    return <LoadingOrError message={`Connecting to game ${gameId}...`} />;
  }

  return (
    <>
      <GameUI />
      <RejoinModal />
    </>
  );
}