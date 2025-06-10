'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, WifiOff, Clock, Copy } from 'lucide-react';
import { Player } from 'shared-types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Magnetic from '@/components/ui/Magnetic';

const StatusIndicator = ({ icon: Icon, text, colorClass }: { icon: React.ElementType, text: string, colorClass: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("flex items-center gap-2 text-sm", colorClass)}
  >
    <Icon className="h-4 w-4" />
    <p>{text}</p>
  </motion.div>
);

const playerCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }),
  exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
};

const PlayerRow = ({ player, isLocalPlayer, index }: { player: Player, isLocalPlayer: boolean, index: number }) => {
  const getStatus = () => {
    if (!player.isConnected) {
      return <StatusIndicator icon={WifiOff} text="Disconnected" colorClass="text-red-500" />;
    }
    if (player.isReady) {
      return <StatusIndicator icon={CheckCircle} text="Ready" colorClass="text-emerald-500" />;
    }
    return <StatusIndicator icon={Clock} text="Waiting" colorClass="text-stone-500" />;
  };

  return (
    <motion.div
      layout
      custom={index}
      variants={playerCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      key={player.id}
      className="flex items-center justify-between p-4 px-5 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 backdrop-blur-md shadow-sm"
      whileHover={{ 
        y: -4, 
        boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.2 } 
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 dark:bg-zinc-800">
          <motion.div
            animate={player.isReady ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: player.isReady ? Infinity : 0, repeatDelay: 2 }}
          >
            {player.isReady ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <Clock className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            )}
          </motion.div>
        </div>
        <span className="font-light text-lg text-stone-800 dark:text-stone-200">
          {player.name} {isLocalPlayer && <span className="text-xs font-light text-stone-500">(You)</span>}
        </span>
      </div>
      {getStatus()}
    </motion.div>
  );
};

export const GameLobby = () => {
  const [state, send] = useUI();
  const [copied, setCopied] = useState(false);

  const { currentGameState, localPlayerId, gameId } = state.context;

  if (!currentGameState || !currentGameState.players) {
    return (
      <motion.div 
        className="flex items-center justify-center min-h-screen font-light"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 rounded-full border-2 border-stone-300 border-t-stone-900 dark:border-t-stone-100 dark:border-zinc-700"
          />
          <p className="text-stone-600 dark:text-stone-400">Opening lobby...</p>
        </div>
      </motion.div>
    );
  }
  
  const players = Object.values(currentGameState.players);
  const localPlayer = localPlayerId ? currentGameState.players[localPlayerId] : null;
  const isGameMaster = localPlayerId === currentGameState.gameMasterId;

  const playerCount = players.length;
  const readyPlayersCount = players.filter((p: Player) => p.isReady).length;
  const allPlayersReady = readyPlayersCount === playerCount && playerCount > 1;
  const hasEnoughPlayers = playerCount >= 2;
  const hasDisconnectedPlayers = players.some((p: Player) => !p.isConnected);

  const handleCopy = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handlePlayerReady = () => send({ type: 'PLAYER_READY' });
  const handleStartGame = () => send({ type: 'START_GAME' });
  
  const getLobbyStatus = () => {
    if (hasDisconnectedPlayers) {
      return <StatusIndicator icon={WifiOff} text="A player is disconnected." colorClass="text-amber-500" />;
    }
    if (!hasEnoughPlayers) {
      return <StatusIndicator icon={Users} text="Waiting for at least 2 players..." colorClass="text-stone-500" />;
    }
    if (!allPlayersReady) {
      return <StatusIndicator icon={Clock} text="Waiting for players to be ready..." colorClass="text-stone-500" />;
    }
    if (allPlayersReady && isGameMaster) {
      return <StatusIndicator icon={CheckCircle} text="All players are ready to start!" colorClass="text-emerald-500" />;
    }
     return <StatusIndicator icon={CheckCircle} text="Ready! Waiting for Game Master to start." colorClass="text-stone-500" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl mx-auto"
    >
      <motion.div className="relative overflow-hidden bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-stone-200 dark:border-zinc-800 backdrop-blur-xl shadow-2xl">
        {/* Background decoration */}
        <motion.div 
          className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-stone-100 to-transparent dark:from-zinc-800/20 rounded-full blur-3xl"
          animate={{ 
            x: [0, 20, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-t from-stone-100 to-transparent dark:from-zinc-800/20 rounded-full blur-3xl"
          animate={{ 
            x: [0, -30, 0],
            y: [0, 20, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-10">
            <motion.h2 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-5xl font-light tracking-tight text-stone-900 dark:text-stone-100"
            >
              Lobby
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-stone-500 mt-2 font-light text-lg"
            >
              {currentGameState?.gameStage === 'DEALING' ? "Dealing cards..." : "Assemble your party"}
            </motion.p>
          </div>

          {gameId && (
            <motion.div 
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <p className="text-sm text-stone-500 mb-3 font-light text-center">Invite friends with this Game ID</p>
              <TooltipProvider delayDuration={0}>
                <Tooltip open={copied}>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Magnetic>
                        <button
                          onClick={handleCopy}
                          className="w-full font-mono text-lg bg-stone-100 dark:bg-zinc-800 p-4 rounded-xl flex items-center justify-between text-stone-800 dark:text-stone-200 transition-all duration-300 hover:shadow-lg border border-stone-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900"
                          data-cursor-link
                        >
                          <span className="flex-1 text-center">{gameId}</span>
                          <motion.div
                            animate={copied ? { scale: [1, 1.5, 1] } : {}}
                            transition={{ duration: 0.3 }}
                            className="ml-3 p-2 bg-stone-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center"
                          >
                            <Copy className="h-4 w-4 text-stone-600 dark:text-stone-300 pointer-events-none" />
                          </motion.div>
                        </button>
                      </Magnetic>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5}>
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      Copied to clipboard!
                    </motion.p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}

          <motion.div 
            className="mb-8 h-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {getLobbyStatus()}
          </motion.div>

          <motion.div 
            className="space-y-4 mb-10 min-h-[180px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <AnimatePresence>
              {players.map((player: Player, index) => (
                <PlayerRow 
                  key={player.id} 
                  player={player} 
                  isLocalPlayer={player.id === localPlayerId}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          <div className="h-20 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {localPlayer && !localPlayer.isReady && (
                <motion.div 
                  key="ready_button"
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="w-full"
                >
                  <Magnetic>
                    <Button 
                      size="lg" 
                      className="w-full h-14 text-lg font-light tracking-wide rounded-full relative overflow-hidden group bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900" 
                      onClick={handlePlayerReady} 
                      disabled={!hasEnoughPlayers}
                      data-cursor-link
                    >
                      <span className="relative z-10">Declare Ready</span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-700 dark:from-stone-200 dark:to-stone-100"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "0%" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </Button>
                  </Magnetic>
                </motion.div>
              )}

              {localPlayer && localPlayer.isReady && !allPlayersReady && (
                <motion.div 
                  key="waiting_message" 
                  className="flex flex-col items-center gap-2" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  >
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </motion.div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">You are ready. Waiting for others...</p>
                </motion.div>
              )}

              {isGameMaster && allPlayersReady && (
                <motion.div 
                  key="start_button"
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="w-full"
                >
                  <Magnetic>
                    <Button 
                      size="lg" 
                      className="w-full h-14 text-lg font-light tracking-wide rounded-full relative overflow-hidden group bg-emerald-600 hover:bg-emerald-500 text-white transition-all duration-300" 
                      onClick={handleStartGame}
                      data-cursor-link
                    >
                      Start Game
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                        className="ml-2"
                      >
                        →
                      </motion.div>
                    </Button>
                  </Magnetic>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}; 