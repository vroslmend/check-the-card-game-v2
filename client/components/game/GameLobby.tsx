'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, WifiOff, Clock, Copy, PartyPopper, UserMinus, MoreHorizontal, RefreshCw } from 'lucide-react';
import { type Player, PlayerActionType } from 'shared-types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Magnetic from '@/components/ui/Magnetic';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Add CSS animation for spinner
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-spinner {
    animation: spin 1.5s linear infinite;
  }
`;

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
  const { send } = useUIActorRef();
  const snapshot = useUISelector(state => state);
  const isGameMaster = snapshot.context.currentGameState?.gameMasterId === snapshot.context.localPlayerId;
  
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimeRequired = 1.5; // seconds required to hold
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const canRemove = isGameMaster && !isLocalPlayer && !player.isConnected;

  // Use this to track progress
  useEffect(() => {
    if (isHolding) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(100, (elapsedTime / (holdTimeRequired * 1000)) * 100);
        setHoldProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          send({ type: PlayerActionType.REMOVE_PLAYER, payload: { playerId: player.id } });
          setIsHolding(false);
          setHoldProgress(0);
        }
      }, 50);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [isHolding, player.id, send]);

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
      className={cn(
        "flex items-center justify-between p-4 px-5 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800 backdrop-blur-md shadow-sm relative",
        !player.isConnected && "opacity-60 grayscale"
      )}
      whileHover={{ 
        y: -4, 
        boxShadow: "0px 8px 20px -5px rgba(0,0,0,0.1)",
        opacity: player.isConnected ? 1 : 0.7, // Increase opacity slightly on hover for disconnected players
        transition: { type: "spring", stiffness: 300, damping: 20 } 
      }}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          player.isReady ? "bg-emerald-100 dark:bg-emerald-900/50" : 
          !player.isConnected ? "bg-red-100/50 dark:bg-red-900/30" :
          "bg-stone-100 dark:bg-zinc-800"
        )}>
          <motion.div
            animate={player.isReady && player.isConnected ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: player.isReady && player.isConnected ? Infinity : 0, repeatDelay: 2 }}
          >
            {!player.isConnected ? (
              <WifiOff className="h-4 w-4 text-red-500/70" />
            ) : player.isReady ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <Clock className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            )}
          </motion.div>
        </div>
        <span className={cn(
          "font-serif text-lg text-stone-800 dark:text-stone-200",
          !player.isConnected && "text-stone-500 dark:text-stone-500"
        )}>
          {player.name} {isLocalPlayer && <span className="text-xs font-light text-stone-500">(You)</span>}
          {!player.isConnected && <span className="text-xs font-light italic ml-2 text-stone-400">(disconnected)</span>}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {getStatus()}
        
        {canRemove && (
          <motion.div 
            initial={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
            className="relative"
          >
            <motion.div 
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onTapStart={() => setIsHolding(true)}
              onTap={() => setIsHolding(false)}
              onHoverEnd={() => setIsHolding(false)}
              onTapCancel={() => setIsHolding(false)}
            >
              <UserMinus className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-500">
                {isHolding ? `${Math.round(holdProgress)}%` : "Remove"}
              </span>
              
              {isHolding && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/20 h-full rounded-full"
                  style={{ width: `${holdProgress}%`, originX: 0 }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
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
  const { send } = useUIActorRef();
  const {
    isLoading,
    players,
    localPlayer,
    isGameMaster,
    allPlayersReady,
    hasEnoughPlayers,
    hasDisconnectedPlayers,
    gameId,
  } = useUISelector(selectLobbyProps);
  const [copied, setCopied] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [leaveButtonHovered, setLeaveButtonHovered] = useState(false);
  const [prevButtonType, setPrevButtonType] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectionTimeout, setReconnectionTimeout] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add timeout for loading state
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        // Show timeout message if loading takes too long
        setReconnectionTimeout(true);
        // Force transition to error state
        send({ type: 'CONNECTION_ERROR', message: 'Reconnection taking too long' });
      }, 8000); // 8 second timeout
      
      return () => clearTimeout(timer);
    } else {
      setReconnectionTimeout(false);
    }
  }, [isLoading, send]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <>
        {/* Add the CSS animation style */}
        <style>{spinnerStyle}</style>
        <motion.div 
          className="flex items-center justify-center min-h-screen font-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Replace the motion.div animation with CSS animation */}
            <div 
              className="h-10 w-10 rounded-full border-2 border-stone-200 dark:border-zinc-800 border-t-stone-900 dark:border-t-stone-100 loading-spinner"
            />
            <p className="text-stone-600 dark:text-stone-400">
              {reconnectionTimeout 
                ? "Reconnection is taking longer than expected..." 
                : "Opening lobby..."}
            </p>
            {reconnectionTimeout && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 px-4 py-2 rounded-full bg-stone-800 text-white text-sm"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </motion.button>
            )}
          </div>
        </motion.div>
      </>
    );
  }
  
  const handleCopy = () => {
    navigator.clipboard.writeText(gameId ?? '');
    setCopied(true);
  };
  
  const handlePlayerReady = () => send({ type: PlayerActionType.DECLARE_LOBBY_READY });
  const handleStartGame = () => send({ type: PlayerActionType.START_GAME });
  const handleLeaveGame = () => send({ type: 'LEAVE_GAME' });
  
  const handleRefreshGameState = () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // Force a CLIENT_GAME_STATE_UPDATED event by sending the appropriate message
    send({ type: 'CONNECT' });
    
    // Set a timeout to reset the refreshing state after 3 seconds to prevent the animation from getting stuck
    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
    }, 3000);
  };
  
  const getLobbyStatus = () => {
    if (!hasEnoughPlayers) {
      return <StatusIndicator icon={Users} text="Waiting for more players..." colorClass="text-stone-500 dark:text-stone-400" />;
    }
    if (!allPlayersReady) {
      return <StatusIndicator icon={Clock} text="Waiting for players to ready up..." colorClass="text-stone-500 dark:text-stone-400" />;
    }
    if (hasDisconnectedPlayers) {
      return <StatusIndicator icon={WifiOff} text="Some players are disconnected but you can still start." colorClass="text-amber-500" />;
    }
    if (allPlayersReady && isGameMaster) {
      return <StatusIndicator icon={PartyPopper} text="All players ready! You can start the game." colorClass="text-emerald-500" />;
    }
     return <StatusIndicator icon={CheckCircle} text="Ready! Waiting for the host to start." colorClass="text-stone-500 dark:text-stone-400" />;
  };

  const canStartGame = isGameMaster && allPlayersReady && hasEnoughPlayers;
  const isPlayerReady = localPlayer?.isReady;
  
  const getButtonConfig = () => {
    if (isGameMaster) {
      if (!isPlayerReady) {
        return {
          text: "Ready Up",
          action: handlePlayerReady,
          disabled: false,
          icon: <CheckCircle className="h-4 w-4 pointer-events-none" />,
          colors: "bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 text-white"
        };
      }
      
      return {
        text: "Start Game",
        action: handleStartGame,
        disabled: !hasEnoughPlayers || !allPlayersReady,
        icon: <PartyPopper className="h-4 w-4 pointer-events-none" />,
        colors: hasEnoughPlayers 
          ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white"
          : "bg-stone-300 dark:bg-zinc-700 text-stone-500 dark:text-stone-400"
      };
    } else {
      return {
        text: isPlayerReady ? "Ready!" : "Ready Up",
        action: handlePlayerReady,
        disabled: isPlayerReady,
        icon: <CheckCircle className="h-4 w-4 pointer-events-none" />,
        colors: "bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 text-white"
      };
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <div className="flex items-center justify-center min-h-screen py-10 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl mx-auto font-serif"
      >
        <div className="relative overflow-hidden bg-white/80 dark:bg-zinc-950/80 rounded-[2.5rem] border border-stone-200 dark:border-zinc-800 backdrop-blur-xl shadow-2xl">
          {/* Decorative elements */}
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
            {/* Leave Game button (top-right corner) */}
            <motion.div
              className="absolute top-5 right-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <Magnetic>
                <motion.button
                  onClick={handleLeaveGame}
                  className="rounded-full px-4 py-2 text-sm border border-stone-200 dark:border-zinc-800 text-stone-500 dark:text-stone-400 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900 relative overflow-hidden"
                  data-cursor-link
                  onMouseEnter={() => setLeaveButtonHovered(true)}
                  onMouseLeave={() => setLeaveButtonHovered(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-100/20 dark:via-rose-900/20 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={{ 
                      x: leaveButtonHovered ? "100%" : "-100%"
                    }}
                    transition={{ 
                      duration: 1, 
                      ease: "easeInOut"
                    }}
                  />
                  <span className="relative z-10 flex items-center gap-1">
                    <motion.span
                      animate={leaveButtonHovered ? { x: -2 } : { x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      Exit
                    </motion.span>
                    <motion.span
                      animate={leaveButtonHovered ? { x: 2 } : { x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      Lobby
                    </motion.span>
                  </span>
                </motion.button>
              </Magnetic>
            </motion.div>

            {/* Add Refresh button (top-left corner) */}
            <motion.div
              className="absolute top-5 left-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <Magnetic>
                <motion.button
                  onClick={handleRefreshGameState}
                  disabled={isRefreshing}
                  className="rounded-full p-2 border border-stone-200 dark:border-zinc-800 text-stone-500 dark:text-stone-400 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900 relative overflow-hidden"
                  data-cursor-link
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={isRefreshing ? { rotate: 360 } : {}}
                    transition={{ 
                      duration: 1,
                      ease: "linear",
                      repeat: isRefreshing ? Infinity : 0,
                      repeatType: "loop"
                    }}
                    onAnimationComplete={() => {
                      if (!isRefreshing) {
                        document.querySelector('.refresh-icon')?.getAnimations().forEach(animation => {
                          animation.cancel();
                        });
                      }
                    }}
                    className="refresh-icon"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </motion.div>
                </motion.button>
              </Magnetic>
            </motion.div>

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
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={isGameMaster && isPlayerReady ? "start-game-btn" : "ready-btn"}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    duration: 0.4
                  }}
                >
                  <Magnetic>
                    <motion.button
                      onClick={buttonConfig.action}
                      disabled={buttonConfig.disabled}
                      className={cn(
                        "h-14 min-w-64 rounded-full shadow-xl px-8 relative overflow-hidden flex items-center justify-center gap-2",
                        buttonConfig.colors,
                        buttonConfig.disabled && "opacity-70 cursor-not-allowed"
                      )}
                      data-cursor-link
                      onMouseEnter={() => setButtonHovered(true)}
                      onMouseLeave={() => setButtonHovered(false)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ 
                          x: buttonHovered ? "100%" : "-100%"
                        }}
                        transition={{ 
                          duration: 1.5, 
                          ease: "easeInOut"
                        }}
                      />
                      
                      <span className="relative z-10 flex items-center gap-2 font-medium">
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {buttonConfig.text}
                        </motion.span>
                        <motion.div
                          animate={
                            buttonConfig.text === "Ready!" || buttonConfig.text === "Start Game" && buttonHovered
                            ? { rotate: [0, 15, -15, 0] }
                            : { x: [0, 5, 0] }
                          }
                          transition={{
                            duration: buttonConfig.text === "Ready!" ? 1 : 1.5,
                            repeat: Infinity,
                            repeatDelay: 1,
                            ease: "easeInOut",
                          }}
                        >
                          {buttonConfig.icon}
                        </motion.div>
                      </span>
                    </motion.button>
                  </Magnetic>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}; 