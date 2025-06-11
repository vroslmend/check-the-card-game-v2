"use client"

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card as ShadCard, CardContent } from '@/components/ui/card';
import { type Player, type Card } from 'shared-types';
import { HandGrid } from './HandGrid';

const OpponentPlayer = ({ player, isCurrent }: { player: Player; isCurrent: boolean }) => {
  const [state, send] = useUI();
  const { abilityContext, localPlayerId } = state.context;

  const isAbilityPlayer = abilityContext?.playerId === localPlayerId;
  
  // Check state using a direct value check
  const currentState = state.value as any;
  const isAbilityActive = Boolean(currentState?.inGame?.playing === 'ability' && isAbilityPlayer);

  const handleCardClick = (card: Card | { facedown: true }, index: number) => {
    if (isAbilityActive) {
      send({
        type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY',
        playerId: player.id,
        cardIndex: index,
      });
    }
  };
  
  const canInteract = isAbilityActive;
  
  const getSelectedIndex = () => {
    if (!abilityContext) return null;

    const { stage, selectedPeekTargets, selectedSwapTargets } = abilityContext;

    if (stage === 'peeking') {
        const target = selectedPeekTargets.find(t => t.playerId === player.id);
        return target ? target.cardIndex : null;
    }
    if (stage === 'swapping') {
        const target = selectedSwapTargets.find(t => t.playerId === player.id);
        return target ? target.cardIndex : null;
    }
    return null;
  }

  const selectedIndex = getSelectedIndex();

  return (
    <motion.div 
      className="relative flex flex-col items-center gap-2"
      animate={{ scale: isCurrent ? 1.05 : 1, y: isCurrent ? -5 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="flex flex-col items-center">
        <Avatar className={`h-12 w-12 border-2 ${isCurrent ? 'border-primary' : 'border-muted'}`}>
          <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.name ?? 'player'}`} />
          <AvatarFallback>{player.name?.substring(0, 2).toUpperCase() ?? 'P'}</AvatarFallback>
        </Avatar>
        <div className="mt-2 text-center">
          <p className="font-medium text-sm">{player.name ?? '...'}</p>
        </div>
        {isCurrent && <motion.div layoutId="activePlayerIndicator" className="absolute -bottom-2 h-1 w-12 rounded-full bg-primary" />}
      </div>

      <div className="mt-2 w-full">
        <HandGrid
          ownerId={player.id}
          hand={player.hand}
          canInteract={canInteract}
          isOpponent
          onCardClick={handleCardClick}
          selectedIndex={selectedIndex}
        />
      </div>

    </motion.div>
  );
};

export const OpponentArea = () => {
  const [state] = useUI();
  const { localPlayerId, currentGameState } = state.context;

  if (!currentGameState || !currentGameState.players) {
    return null; // Don't render if the player data isn't available yet
  }

  const opponentPlayers = Object.entries(currentGameState.players)
    .filter(([id]) => id !== localPlayerId);

  return (
    <ShadCard className="h-full">
      <CardContent className="flex h-full items-start justify-around p-4 gap-4">
        <AnimatePresence>
          {opponentPlayers.map(([id, player]) => (
            <OpponentPlayer
              key={id}
              player={player}
              isCurrent={id === currentGameState.currentPlayerId}
            />
          ))}
        </AnimatePresence>
      </CardContent>
    </ShadCard>
  );
};