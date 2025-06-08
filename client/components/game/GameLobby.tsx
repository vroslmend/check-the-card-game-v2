'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { ClientPlayerState, PlayerActionType } from 'shared-types';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Users } from 'lucide-react';

export const GameLobby = () => {
  const players = useGameStore((state) => state.currentGameState?.players ?? {});
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const emit = useGameStore((state) => state.emit);

  const localPlayer = localPlayerId ? players[localPlayerId] : null;

  const handleDeclareReady = () => {
    if (localPlayerId) {
      emit(PlayerActionType.DECLARE_READY_FOR_PEEK, {
        playerId: localPlayerId,
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 bg-card rounded-2xl shadow-lg border"
      >
        <div className="flex flex-col items-center text-center mb-8">
            <Users className="h-10 w-10 mb-4 text-muted-foreground" />
            <h2 className="text-3xl font-light">Game Lobby</h2>
            <p className="text-muted-foreground">Waiting for players to get ready...</p>
        </div>
        
        <div className="space-y-3 mb-8">
          {Object.entries(players).map(([id, player]) => (
            <div key={id} className="flex items-center justify-between p-4 rounded-xl bg-background">
              <span className="font-medium">{player.name} {id === localPlayerId && "(You)"}</span>
              {player.isReadyForInitialPeek ? (
                <span className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-5 w-5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Circle className="h-5 w-5" /> Not Ready
                </span>
              )}
            </div>
          ))}
        </div>

        {localPlayer && !localPlayer.isReadyForInitialPeek && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <Button size="lg" className="w-full h-12 text-lg font-light" onClick={handleDeclareReady}>
              Declare Ready
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}; 