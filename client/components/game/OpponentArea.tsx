"use client"

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useGameStore } from '@/store/gameStore';
import { ClientPlayerState } from 'shared-types';

const OpponentPlayer = ({ player, isCurrent, cardCount }: { player: ClientPlayerState; isCurrent: boolean; cardCount: number }) => {
  return (
    <motion.div 
      className="relative flex flex-col items-center gap-2"
      animate={{ scale: isCurrent ? 1.05 : 1, y: isCurrent ? -5 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Avatar className={`h-16 w-16 border-2 ${isCurrent ? 'border-primary' : 'border-muted'}`}>
        <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.name ?? 'player'}`} />
        <AvatarFallback>{player.name?.substring(0, 2).toUpperCase() ?? 'P'}</AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="font-medium">{player.name ?? '...'}</p>
        <p className="text-sm text-muted-foreground">{cardCount} Cards</p>
      </div>
      {isCurrent && <motion.div layoutId="activePlayerIndicator" className="absolute -bottom-2 h-1 w-12 rounded-full bg-primary" />}
    </motion.div>
  );
};

export const OpponentArea = () => {
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const players = useGameStore((state) => state.currentGameState?.players ?? {});
  const currentPlayerId = useGameStore((state) => state.currentGameState?.currentPlayerId);

  const opponentPlayers = Object.entries(players)
    .filter(([id]) => id !== localPlayerId);

  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-center justify-around p-4">
        <AnimatePresence>
          {opponentPlayers.map(([id, player]) => (
            <OpponentPlayer
              key={id}
              player={player}
              isCurrent={id === currentPlayerId}
              cardCount={player.hand.length} 
            />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}; 