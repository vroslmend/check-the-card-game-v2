'use client';

import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, WifiOff, Clock, Copy, PartyPopper } from 'lucide-react';
import { type Player } from 'shared-types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Magnetic from '@/components/ui/Magnetic';

const StatusIndicator = ({ icon: Icon, text, colorClass }: { icon: React.ElementType, text: string, colorClass: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("flex items-center gap-2 text-sm font-light", colorClass)}
  >
    <Icon className="h-4 w-4" />
    <p>{text}</p>
  </motion.div>
);

const playerCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      type: 'spring',
      stiffness: 100,
      damping: 15
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
    return <StatusIndicator icon={Clock} text="Waiting" colorClass="text-stone-500 dark:text-stone-400" />;
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
      className="flex items-center justify-between p-4 px-5 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 backdrop-blur-md shadow-sm"
      whileHover={{ 
        y: -4, 
        boxShadow: "0px 8px 20px -5px rgba(0,0,0,0.1)",
        transition: { type: "spring", stiffness: 300, damping: 20 } 
      }}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          player.isReady ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-stone-100 dark:bg-zinc-800"
        )}>
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
        <span className="font-serif text-lg text-stone-800 dark:text-stone-200">
          {player.name} {isLocalPlayer && <span className="text-xs font-light text-stone-500">(You)</span>}
        </span>
      </div>
      {getStatus()}
    </motion.div>
  );
};

const selectLobbyProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId, gameId } = state.context;

  if (!currentGameState || !currentGameState.players) {
    return {
      isLoading: true,
      players: [],
      localPlayer: null,
      isGameMaster: false,
      playerCount: 0,
      readyPlayersCount: 0,
      allPlayersReady: false,
      hasEnoughPlayers: false,
      hasDisconnectedPlayers: false,
      gameId,
    };
  }

  const players = Object.values(currentGameState.players);
  const localPlayer = localPlayerId ? currentGameState.players[localPlayerId] : null;
  const isGameMaster = localPlayerId === currentGameState.gameMasterId;

  const playerCount = players.length;
  const readyPlayersCount = players.filter((p: Player) => p.isReady).length;
  const allPlayersReady = readyPlayersCount === playerCount && playerCount > 1;
  const hasEnoughPlayers = playerCount >= 2;
  const hasDisconnectedPlayers = players.some((p: Player) => !p.isConnected);

  return {
    isLoading: false,
    players,
    localPlayer,
    isGameMaster,
    playerCount,
    readyPlayersCount,
    allPlayersReady,
    hasEnoughPlayers,
    hasDisconnectedPlayers,
    gameId,
  };
};

export const GameLobby = () => {
  const { actorRef } = useContext(UIContext)!;
  const {
    isLoading,
    players,
    localPlayer,
    isGameMaster,
    allPlayersReady,
    hasEnoughPlayers,
    hasDisconnectedPlayers,
    gameId,
  } = useSelector(actorRef, selectLobbyProps);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <motion.div 
        className="flex items-center justify-center min-h-screen font-serif"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 rounded-full border-2 border-stone-200 dark:border-zinc-800 border-t-stone-900 dark:border-t-stone-100"
          />
          <p className="text-stone-600 dark:text-stone-400">Opening lobby...</p>
        </div>
      </motion.div>
    );
  }
  
  const handleCopy = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handlePlayerReady = () => actorRef.send({ type: 'PLAYER_READY' });
  const handleStartGame = () => actorRef.send({ type: 'START_GAME' });
  
  const getLobbyStatus = () => {
    if (hasDisconnectedPlayers) {
      return <StatusIndicator icon={WifiOff} text="A player is disconnected." colorClass="text-amber-500" />;
    }
    if (!hasEnoughPlayers) {
      return <StatusIndicator icon={Users} text="Waiting for more players..." colorClass="text-stone-500 dark:text-stone-400" />;
    }
    if (!allPlayersReady) {
      return <StatusIndicator icon={Clock} text="Waiting for players to ready up..." colorClass="text-stone-500 dark:text-stone-400" />;
    }
    if (allPlayersReady && isGameMaster) {
      return <StatusIndicator icon={PartyPopper} text="All players ready! You can start the game." colorClass="text-emerald-500" />;
    }
     return <StatusIndicator icon={CheckCircle} text="Ready! Waiting for the host to start." colorClass="text-stone-500 dark:text-stone-400" />;
  };

  const canStartGame = isGameMaster && allPlayersReady && !hasDisconnectedPlayers;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl mx-auto font-serif"
    >
      <div className="relative overflow-hidden bg-white/80 dark:bg-zinc-950/80 rounded-[2.5rem] border border-stone-200 dark:border-zinc-800 backdrop-blur-xl shadow-2xl">
        {/* Decorative elements from guidelines */}
        <motion.div 
          className="absolute -top-10 -right-10 w-64 h-64 bg-gradient-to-br from-stone-100 dark:from-zinc-900 rounded-full blur-3xl"
          animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-10 -left-10 w-72 h-72 bg-gradient-to-t from-stone-100 dark:from-zinc-900 rounded-full blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-10">
            <motion.h2 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-5xl font-light tracking-tighter text-stone-900 dark:text-stone-100"
            >
              Game Lobby
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-stone-500 dark:text-stone-400 mt-2 text-lg"
            >
              Assemble your party
            </motion.p>
          </div>

          {gameId && (
            <motion.div 
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 font-light text-center">Invite players with this Game ID</p>
              <TooltipProvider delayDuration={100}>
                <Tooltip open={copied}>
                  <TooltipTrigger asChild>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="group"
                    >
                      <button 
                        onClick={handleCopy} 
                        className="w-full text-lg tracking-widest font-mono p-4 rounded-2xl bg-stone-100 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-800 flex items-center justify-center gap-4 transition-colors hover:border-stone-300 dark:hover:border-zinc-700"
                        data-cursor-link
                      >
                        {gameId}
                        <motion.div
                          animate={copied ? { scale: [1, 1.5, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          <Copy className="h-5 w-5 text-stone-500 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors" />
                        </motion.div>
                      </button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="font-sans">
                    <p>Copied!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}

          <motion.div 
            className="space-y-3 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1, delayChildren: 0.5 }}
          >
            <AnimatePresence>
              {players.map((p, i) => (
                <PlayerRow key={p.id} player={p} isLocalPlayer={p.id === localPlayer?.id} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.div 
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <div className="h-10 mb-6 flex items-center justify-center">
              {getLobbyStatus()}
            </div>
            
            <Magnetic>
              {!isGameMaster && (
                <Button 
                  size="lg" 
                  onClick={handlePlayerReady} 
                  disabled={localPlayer?.isReady}
                  className="w-64 rounded-full shadow-xl"
                  data-cursor-link
                >
                  {localPlayer?.isReady ? 'Ready!' : 'Ready Up'}
                </Button>
              )}
              {isGameMaster && (
                 <Button 
                  size="lg" 
                  onClick={handleStartGame} 
                  disabled={!canStartGame}
                  className="w-64 rounded-full shadow-xl"
                  data-cursor-link
                >
                  Start Game
                </Button>
              )}
            </Magnetic>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}; 