'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { User, Crown } from 'lucide-react';

export function OpponentArea() {
  const [state] = useUI();
  const { currentGameState, localPlayerId } = state.context;

  if (!currentGameState || !localPlayerId) {
    return null;
  }

  const players = Object.entries(currentGameState.players || {})
    .filter(([id]) => id !== localPlayerId);

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-stone-100 dark:bg-stone-800 px-4 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400"
        >
          Waiting for other players to join...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 max-w-3xl">
      <div className="flex items-center justify-center gap-6 md:gap-10 lg:gap-16">
        {players.map(([playerId, player]) => {
          const isCurrentTurn = currentGameState.currentPlayerId === playerId;
          const cardCount = player.hand?.length || 0;
          
          return (
            <motion.div
              key={playerId}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isCurrentTurn 
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' 
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }
                  `}>
                    <User className="h-5 w-5" />
                  </div>
                  {isCurrentTurn && (
                    <motion.div
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-white dark:border-stone-900"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: [0.8, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  {/* First player (index 0) gets a crown indicator */}
                  {players[0][0] === playerId && (
                    <motion.div
                      className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center border border-blue-200 dark:border-blue-800/30"
                      initial={{ rotate: -10 }}
                      animate={{ rotate: [0, 10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                    >
                      <Crown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </motion.div>
                  )}
                </div>
                <span className="font-medium text-stone-800 dark:text-stone-200">
                  {player.name || 'Player'}
                </span>
              </div>
              
              {/* Card backs */}
              <div className="relative h-16 w-24">
                {Array.from({ length: Math.min(cardCount, 4) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute bg-gradient-to-br from-stone-800 to-stone-900 dark:from-stone-700 dark:to-stone-800 rounded-lg shadow-md"
                    style={{
                      width: '2.5rem',
                      height: '3.5rem',
                      left: `${i * 4}px`,
                      top: `${i * 2}px`,
                      transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`,
                      zIndex: i,
                      border: '1px solid rgba(255,255,255,0.1)',
                      backgroundImage: "url('/card-sprites/card-back.svg')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                ))}
                <div className="absolute -bottom-1 right-0 text-xs bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full px-2 py-0.5 font-medium">
                  {cardCount}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
} 