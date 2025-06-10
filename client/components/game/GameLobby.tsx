'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Circle, Users, WifiOff, Clock } from 'lucide-react';
import { Player } from 'shared-types';

export const GameLobby = () => {
  const [state, send] = useUI();

  const { currentGameState, localPlayerId, gameId } = state.context;

  if (!currentGameState || !currentGameState.players) {
    // This is a transitional state, so render a minimal loader or nothing.
    return <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">Loading Lobby...</div>;
  }

  const players = currentGameState.players;
  const localPlayer = localPlayerId ? players[localPlayerId] : null;
  
  // Calculate status information
  const playerCount = Object.keys(players).length;
  const readyPlayersCount = Object.values(players).filter((player: Player) => player.isReady).length;
  const allPlayersReady = readyPlayersCount === playerCount && playerCount > 0;
  const hasEnoughPlayers = playerCount >= 2;
  const hasDisconnectedPlayers = Object.values(players).some((player: Player) => !player.isConnected);
  
  const handleDeclareReady = () => {
    if (localPlayerId) {
      send({ type: 'DECLARE_READY_FOR_PEEK_CLICKED' });
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
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              {currentGameState?.gameStage === 'DEALING'
                ? "Dealing cards..."
                : "Waiting for players to get ready..."}
            </p>
          </div>
          
          {!hasEnoughPlayers && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-amber-500 flex items-center gap-2"
            >
              <AlertCircle className="h-5 w-5" />
              <p>Need at least 2 players to start</p>
            </motion.div>
          )}
          
          {hasEnoughPlayers && !allPlayersReady && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-amber-500 flex items-center gap-2"
            >
              <Clock className="h-5 w-5" />
              <p>Waiting for all players to be ready...</p>
            </motion.div>
          )}
          
          {hasDisconnectedPlayers && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-red-500 flex items-center gap-2"
            >
              <WifiOff className="h-5 w-5" />
              <p>Some players are disconnected</p>
            </motion.div>
          )}
        </div>
        
        {gameId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6 flex flex-col items-center"
          >
            <p className="text-sm text-muted-foreground">Game ID:</p>
            <p className="font-mono text-sm bg-background p-2 rounded-md">{gameId}</p>
            <p className="text-sm text-muted-foreground mt-1">Share this code with friends to join!</p>
          </motion.div>
        )}
        
        <div className="space-y-3 mb-8">
          {Object.entries(players).map(([id, player]: [string, Player]) => (
            <motion.div 
              key={id} 
              className="flex items-center justify-between p-4 rounded-xl bg-background"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="font-medium flex items-center gap-2">
                {player.name} {id === localPlayerId && "(You)"}
              </span>
              {player.isConnected ? (
                player.isReady ? (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-5 w-5" /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Circle className="h-5 w-5" /> Not Ready
                  </span>
                )
              ) : (
                <span className="flex items-center gap-2 text-red-500">
                  <WifiOff className="h-5 w-5" /> Disconnected
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {localPlayer && !localPlayer.isReady && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2 }}
            >
              <Button 
                size="lg" 
                className="w-full h-12 text-lg font-light" 
                onClick={handleDeclareReady}
                disabled={!hasEnoughPlayers}
              >
                Declare Ready
              </Button>
              {!hasEnoughPlayers && (
                <p className="text-sm text-center mt-2 text-muted-foreground">
                  Waiting for more players to join...
                </p>
              )}
            </motion.div>
          )}
          {localPlayer && localPlayer.isReady && !allPlayersReady && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center p-4 bg-muted/30 rounded-xl"
            >
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You&apos;re ready! Waiting for others...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}; 