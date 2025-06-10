'use client';

import React from 'react';
import { HandGrid } from './HandGrid';
import { type Player, type PlayerId } from 'shared-types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface PlayerHandProps {
  player: Player;
  localPlayerId: PlayerId;
  canInteract: boolean;
  onCardClick?: (cardIndex: number) => void;
  selectedCardIndex?: number | null;
  className?: string;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ 
  player, 
  localPlayerId,
  canInteract, 
  onCardClick,
  selectedCardIndex,
  className
}) => {
  const isLocalPlayer = player.id === localPlayerId;
  
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* Player name tag */}
      <motion.div
        initial={{ opacity: 0, y: isLocalPlayer ? 20 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full",
          "bg-stone-100 dark:bg-zinc-900",
          "shadow-sm",
          isLocalPlayer ? "mb-3" : "mt-1 mb-2"
        )}
      >
        {isLocalPlayer && (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
          </div>
        )}
        <span className={cn(
          "text-sm font-light",
          isLocalPlayer 
            ? "text-stone-900 dark:text-stone-100" 
            : "text-stone-600 dark:text-stone-400"
        )}>
          {isLocalPlayer ? 'Your Hand' : `${player.name}'s Hand`}
        </span>
      </motion.div>
      
      {/* Cards */}
      <HandGrid
        ownerId={player.id}
        hand={player.hand}
        isOpponent={!isLocalPlayer}
        canInteract={canInteract && isLocalPlayer}
        selectedIndex={selectedCardIndex}
        onCardClick={(_, index) => {
          if (onCardClick) {
            onCardClick(index);
          }
        }}
      />
    </div>
  );
};

export default PlayerHand;