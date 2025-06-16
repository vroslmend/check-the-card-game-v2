'use client';

import React from 'react';
import { type Player, type Card } from 'shared-types';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Crown, PartyPopper } from 'lucide-react';
import { PlayingCard } from '@/components/cards/PlayingCard';
import { cn } from '@/lib/utils';
import { useUISelector } from '@/context/GameUIContext';

interface GameEndScreenProps {
  players: Player[];
  winnerId: string | null;
  localPlayerId: string;
  onPlayAgain: () => void;
}

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 200, damping: 20 },
  },
};

const selectIsGameMaster = (state: any) => state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

export const GameEndScreen = ({ players, winnerId, localPlayerId, onPlayAgain }: GameEndScreenProps) => {
  const winner = players.find(p => p.id === winnerId);
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const isGameMaster = useUISelector(selectIsGameMaster);

  return (
    <motion.div
      className="absolute inset-0 bg-zinc-900/70 backdrop-blur-lg flex items-center justify-center z-50 p-4 font-serif"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="w-full max-w-3xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 border border-stone-200 dark:border-zinc-800"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-2 text-center">
          <PartyPopper className="w-16 h-16 text-amber-500" />
          <h1 className="text-5xl font-light tracking-tighter text-zinc-800 dark:text-zinc-100">
            {winner ? `${winner.name} Wins!` : 'Round Over!'}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">Final Scores</p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              variants={itemVariants}
              className={cn(
                'p-4 rounded-2xl transition-all duration-300',
                player.id === winnerId 
                  ? 'bg-amber-100/60 dark:bg-amber-900/30 border-2 border-amber-400/80' 
                  : 'bg-white/60 dark:bg-zinc-900/60 border border-stone-200 dark:border-zinc-800'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-bold text-xl text-zinc-800 dark:text-zinc-200">
                  {player.id === winnerId && <Crown className="w-6 h-6 text-amber-500" />}
                  <span>{player.name} {player.id === localPlayerId && <span className="text-sm font-light text-stone-500">(You)</span>}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-2xl font-semibold text-zinc-800 dark:text-zinc-100">{player.score}</span>
                  <span className="text-xs font-light text-stone-500">Points</span>
                </div>
              </div>
              
              <motion.div 
                className="flex items-center justify-center gap-2"
                variants={cardContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {player.hand
                  .filter((c): c is Card => typeof c === 'object' && 'rank' in c)
                  .map((card, cardIndex) => (
                  <motion.div key={cardIndex} variants={cardItemVariants}>
                    <PlayingCard
                      card={card}
                      faceDown={false}
                      size="xxs"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
        
        {isGameMaster && (
          <motion.div variants={itemVariants}>
            <Button onClick={onPlayAgain} size="lg" className="rounded-full px-8 py-6 text-lg">
              Play Again
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}; 