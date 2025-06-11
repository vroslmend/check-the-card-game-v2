"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { User, ShieldCheck, CheckCircle, WifiOff, Clock } from 'lucide-react';
import { type Player, TurnPhase } from 'shared-types';
import { cn } from '@/lib/utils';
import PlayerHand from './PlayerHand';
import { GameActionControls } from './GameActionControls';
import React from 'react';

interface PlayerPodProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
  onCardClick: (cardIndex: number) => void;
  isChoosingSwapTarget: boolean;
}

const StatusIndicator = ({ icon: Icon, text, colorClass }: { icon: React.ElementType, text: string, colorClass: string }) => (
    <div className={cn("flex items-center gap-1.5 text-xs font-light", colorClass)}>
      <Icon className="h-3 w-3" />
      <p>{text}</p>
    </div>
);

export const PlayerPod = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
  onCardClick,
  isChoosingSwapTarget,
}: PlayerPodProps) => {

  const getStatus = () => {
    if (player.hasCalledCheck) return <StatusIndicator icon={ShieldCheck} text="Check Called" colorClass="text-blue-500" />
    if (!player.isConnected) return <StatusIndicator icon={WifiOff} text="Disconnected" colorClass="text-red-500" />;
    if (player.isReady) return <StatusIndicator icon={CheckCircle} text="Ready" colorClass="text-emerald-500" />;
    return <StatusIndicator icon={Clock} text="Waiting" colorClass="text-stone-500 dark:text-stone-400" />;
  };

  const podVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
    exit: { opacity: 0, y: 50 },
  };

  if (isLocalPlayer) {
    return (
      <motion.div
        variants={podVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-5xl mx-auto flex flex-col items-center gap-4"
      >
        <div className="w-full h-[150px] flex items-center justify-center">
          <PlayerHand
            player={player}
            isLocalPlayer={true}
            onCardClick={onCardClick}
            isChoosingSwapTarget={isChoosingSwapTarget}
          />
        </div>
        <motion.div
          className={cn(
            "relative w-full max-w-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-[2.5rem] border border-stone-200 dark:border-zinc-800 shadow-xl transition-all duration-500",
            isCurrentTurn && "shadow-emerald-500/20"
          )}
          animate={{ scale: isCurrentTurn ? 1.02 : 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <AnimatePresence>
            {isCurrentTurn && (
              <motion.div
                className="absolute inset-0 rounded-[2.5rem] border-2 border-emerald-500 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.7, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </AnimatePresence>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <User className="h-6 w-6" />
              </div>
              <div>
                <span className="font-serif text-xl text-stone-900 dark:text-stone-100">{player.name}</span>
                {isCurrentTurn ?
                    <p className="text-sm font-light text-emerald-600 dark:text-emerald-400">It's your turn!</p>
                    : <p className="text-sm font-light text-stone-500 dark:text-stone-400">Waiting for turn...</p>
                }
              </div>
            </div>
            <div className="flex-grow flex items-center justify-center">
              <GameActionControls />
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Opponent Pod
  return (
    <motion.div
      variants={podVariants}
      initial="hidden"
      animate={{
        ...podVariants.visible,
        scale: isCurrentTurn ? 1.05 : 1,
        y: isCurrentTurn ? -5 : 0
      }}
      exit="exit"
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/60 dark:bg-zinc-900/60 border transition-all duration-300",
        isCurrentTurn ? 'border-emerald-500/50 shadow-lg' : 'border-stone-200 dark:border-zinc-800'
      )}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
            <div className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-full",
                isCurrentTurn ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-stone-100 dark:bg-zinc-800"
            )}>
                 <User className={cn("h-4 w-4", isCurrentTurn ? "text-emerald-600 dark:text-emerald-400" : "text-stone-500 dark:text-stone-400")} />
            </div>
            <span className="font-serif text-base text-stone-800 dark:text-stone-200">{player.name}</span>
        </div>
        <div className="mt-2 h-4">
            {getStatus()}
        </div>
      </div>
      <div className="mt-1 w-full">
        <PlayerHand
          player={player}
          isLocalPlayer={false}
          onCardClick={onCardClick}
          isChoosingSwapTarget={false} // Opponents can't be choosing a swap target
        />
      </div>
    </motion.div>
  );
}; 