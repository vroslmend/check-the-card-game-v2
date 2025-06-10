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
  const { abilityContext } = state.context;

  const isAbilityActive = state.matches({ inGame: { playing: { ability: 'selecting' } } });

  const handleCardClick = (card: Card | { facedown: true }, index: number) => {
    if (isAbilityActive) {
      send({
        type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY',
        playerId: player.id,
        cardIndex: index,
      });
    }
  };
  
  // Determine if the player's hand is interactive
  const canInteract = isAbilityActive;
  
  // Determine which card might be selected for an ability
  let selectedIndex: number | null = null;
  if (abilityContext?.payload) {
    const { type, payload } = abilityContext;
    if (type === 'peek') {
      const peekPayload = payload as Partial<import('shared-types').PeekAbilityPayload>;
      if (peekPayload.targetPlayerId === player.id) {
        selectedIndex = peekPayload.cardIndex ?? null;
      }
    } else if (type === 'swap') {
      const swapPayload = payload as Partial<import('shared-types').SwapAbilityPayload>;
      if (swapPayload.sourcePlayerId === player.id) {
        selectedIndex = swapPayload.sourceCardIndex ?? null;
      } else if (swapPayload.targetPlayerId === player.id) {
        selectedIndex = swapPayload.targetCardIndex ?? null;
      }
    }
  }


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