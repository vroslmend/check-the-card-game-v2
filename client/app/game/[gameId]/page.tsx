'use client';

import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { GameHeader } from '@/components/game/GameHeader';
import { OpponentArea } from '@/components/game/OpponentArea';
import { TableArea } from '@/components/game/TableArea';
import { LocalPlayerArea } from '@/components/game/LocalPlayerArea';
import SidePanel from '@/components/layout/SidePanel';
import { GameLobby } from '@/components/game/GameLobby';
import { useGameStore } from '@/store/gameStore';
import { ClientCard, GamePhase } from 'shared-types';

const GamePage = () => {
  const gameState = useGameStore((state) => state.currentGameState);
  const gamePhase: GamePhase | undefined = gameState?.currentPhase;
  const isLoading = useGameStore((state) => !state.currentGameState || !state.localPlayerId);
  const gameId = useGameStore((state) => state.gameId);

  const handleCardClick = (card: ClientCard, index: number) => {
    console.log(`Card clicked: ${card.id} at index ${index}`);
  };

  if (isLoading || !gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-3xl font-bold">[Loading Game...]</h1>
        <p className="font-mono text-sm text-muted-foreground mt-2">Game ID: {gameId}</p>
      </div>
    );
  }

  // The lobby is shown when the server is in the 'awaitingPlayers' or 'initialPeekPhase' phase.
  if (gamePhase && (gamePhase === 'awaitingPlayers' || gamePhase === 'initialPeekPhase')) {
    return <GameLobby />;
  }
  
  return (
    <LayoutGroup>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <GameHeader />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col p-6 space-y-4">
            {/* Opponent Area */}
            <motion.div className="flex-[2]" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <OpponentArea />
            </motion.div>

            {/* Table Area */}
            <motion.div className="flex-[3]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <TableArea />
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