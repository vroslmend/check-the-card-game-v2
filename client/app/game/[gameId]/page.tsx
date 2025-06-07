'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useUIMachineRef, useUIMachineSelector } from '@/machines/uiMachineProvider';
import { LayoutGroup, motion } from 'framer-motion';
import { GameHeader } from '@/components/game/GameHeader';
import { OpponentArea } from '@/components/game/OpponentArea';
import { TableArea } from '@/components/game/TableArea';
import { LocalPlayerArea } from '@/components/game/LocalPlayerArea';
import SidePanel from '@/components/layout/SidePanel';
import { ClientPlayerState, ClientCard } from 'shared-types';

const GamePage = () => {
  const params = useParams();
  const gameId = params.gameId as string;

  const uiMachineActorRef = useUIMachineRef();

  // --- Store and Machine Selectors ---
  const currentGameState = useGameStore((state) => state.currentGameState);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const isSidePanelOpen = useGameStore((state) => state.isSidePanelOpen);
  const toggleSidePanel = useGameStore((state) => state.toggleSidePanel);

  const canDrawFromDeck = useUIMachineSelector(
    (state) => state.can({ type: 'DRAW_FROM_DECK_CLICKED' })
  );
  const canDrawFromDiscard = useUIMachineSelector(
    (state) => state.can({ type: 'DRAW_FROM_DISCARD_CLICKED' })
  );

  // --- Derived State for Components ---
  const viewingPlayer = localPlayerId ? currentGameState?.players[localPlayerId] : null;
  const opponentPlayers: { id: string; player: ClientPlayerState }[] = Object.entries(currentGameState?.players || {})
    .filter(([id]) => id !== localPlayerId)
    .map(([id, player]) => ({ id, player }));
    
  const currentPlayerName = currentGameState?.players[currentGameState.currentPlayerId]?.name ?? 'Unknown';
  const gamePhase = useUIMachineSelector((state) => {
    if (state.matches('initialSetup')) return 'initialSetup';
    if (state.matches('playerAction')) return 'playerAction';
    if (state.matches('awaitingServerResponse')) return 'waitingForServer';
    if (state.matches('idle')) return 'playerAction';
    return 'waitingForServer';
  });

  // Effect to initialize the UI machine
  useEffect(() => {
    if (gameId && localPlayerId) {
      uiMachineActorRef.send({ type: 'INITIALIZE', gameId, localPlayerId });
    }
  }, [gameId, localPlayerId, uiMachineActorRef]);

  // --- Event Handlers ---
  const handleCardClick = (card: ClientCard, cardIndex: number) => {
    uiMachineActorRef.send({ type: 'HAND_CARD_CLICKED', cardIndex });
  };

  const handleDeckClick = () => {
    uiMachineActorRef.send({ type: 'DRAW_FROM_DECK_CLICKED' });
  };

  const handleDiscardClick = () => {
    uiMachineActorRef.send({ type: 'DRAW_FROM_DISCARD_CLICKED' });
  };

  if (!currentGameState || !localPlayerId || !viewingPlayer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-3xl font-bold">[Loading Game...]</h1>
        <p className="font-mono text-sm text-muted-foreground mt-2">Game ID: {gameId}</p>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <GameHeader gameId={gameId} onToggleSidePanel={toggleSidePanel} sidePanelOpen={isSidePanelOpen} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col p-6 space-y-4">
            {/* Opponent Area */}
            <motion.div className="flex-[2]" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <OpponentArea players={opponentPlayers} currentPlayerId={currentGameState.currentPlayerId} />
            </motion.div>

            {/* Table Area */}
            <motion.div className="flex-[3]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <TableArea
                deckSize={currentGameState.deckSize}
                discardPile={currentGameState.discardPile}
                currentPlayerName={currentPlayerName}
                gamePhase={gamePhase}
                discardPileIsSealed={false} // Placeholder
                canDrawFromDeck={canDrawFromDeck}
                canDrawFromDiscard={canDrawFromDiscard}
                onDeckClick={handleDeckClick}
                onDiscardClick={handleDiscardClick}
                matchingOpportunityInfo={null} // Placeholder
              />
            </motion.div>

            {/* Local Player Area */}
            <motion.div className="flex-[4]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <LocalPlayerArea onCardClick={handleCardClick} />
            </motion.div>
      </main>

          <SidePanel />
        </div>
    </div>
    </LayoutGroup>
  );
};

export default GamePage; 