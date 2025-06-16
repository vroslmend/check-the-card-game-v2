'use client';

import React from 'react';
import { useUISelector, type UIMachineSnapshot } from '@/context/GameUIContext';
import { HandGrid } from './HandGrid';
import { type Player, type Card, type PublicCard } from 'shared-types';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  player: Player;
  isLocalPlayer: boolean;
  onCardClick: (cardIndex: number) => void;
  className?: string;
  canInteract: boolean;
  selectedCardIndex?: number | null;
  cardSize?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
}

const selectVisibleCards = (state: UIMachineSnapshot) => state.context.visibleCards;

const PlayerHand: React.FC<PlayerHandProps> = ({ 
  player, 
  isLocalPlayer,
  onCardClick,
  className,
  canInteract,
  selectedCardIndex = null,
  cardSize = 'xs'
}) => {
  const visibleCards = useUISelector(selectVisibleCards);
  
  const handToDisplay = isLocalPlayer
    ? player.hand.map((card, index) => {
        const visibleCard = visibleCards.find(
          vc => vc.playerId === player.id && vc.cardIndex === index
        );
        return visibleCard ? visibleCard.card : ({ facedown: true as const, id: card.id });
      })
    : player.hand;

  return (
    <HandGrid
      ownerId={player.id}
      hand={handToDisplay}
      canInteract={canInteract}
      onCardClick={(_, index) => onCardClick(index)}
      selectedCardIndices={selectedCardIndex !== null ? [selectedCardIndex] : []}
      className={className}
      cardSize={cardSize}
    />
  );
};

export default PlayerHand;