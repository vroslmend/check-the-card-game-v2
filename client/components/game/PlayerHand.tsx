'use client';

import React from 'react';
import { useUISelector, type UIMachineSnapshot } from '@/context/GameUIContext';
import { HandGrid } from './HandGrid';
import { type Player, TurnPhase, GameStage, type ClientAbilityContext, type PeekTarget, type SwapTarget, type Card } from 'shared-types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Eye } from 'lucide-react';

interface PlayerHandProps {
  player: Player;
  isLocalPlayer: boolean;
  onCardClick: (cardIndex: number) => void;
  className?: string;
  isTargetable?: boolean;
  abilityContext?: ClientAbilityContext;
  selectedCardIndex?: number | null;
}

const selectPlayerHandProps = (state: UIMachineSnapshot) => {
  const { currentGameState, currentAbilityContext, localPlayerId, visibleCards } = state.context;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;
  const isMatchingPhase = currentGameState?.turnPhase === TurnPhase.MATCHING;
  const isMyDiscardPhase = isMyTurn && currentGameState?.turnPhase === TurnPhase.DISCARD;
  const inAbilityState = !!currentAbilityContext;
  
  const baseCanInteract = inAbilityState || isMatchingPhase || isMyDiscardPhase;

  return {
    baseCanInteract,
    gameStage: currentGameState?.gameStage,
    visibleCards,
  }
};

const PlayerHand: React.FC<PlayerHandProps> = ({ 
  player, 
  isLocalPlayer,
  onCardClick,
  className,
  isTargetable = false,
  abilityContext,
  selectedCardIndex = null
}) => {
  const { baseCanInteract, gameStage, visibleCards } = useUISelector(selectPlayerHandProps);
  
  const canInteract = isLocalPlayer ? (baseCanInteract || isTargetable) : isTargetable;
  
  const handToDisplay = isLocalPlayer
    ? player.hand.map((card, index) => {
        const visibleCard = visibleCards.find(
          vc => vc.playerId === player.id && vc.cardIndex === index
        );
        return visibleCard ? visibleCard.card : ({ facedown: true } as const);
      })
    : player.hand;

  const isInitialPeek = gameStage === GameStage.INITIAL_PEEK;

  const getHighlightedIndices = (): number[] => {
    if (!abilityContext || !isTargetable) return [];

    // Combine both peek and swap targets from the context
    const selectedTargets = [
      ...(abilityContext.selectedPeekTargets || []),
      ...(abilityContext.selectedSwapTargets || []),
    ];

    // Filter for targets that belong to the current player and return their indices
    return selectedTargets
      .filter((target) => target.playerId === player.id)
      .map((target) => target.cardIndex);
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      {/* Removed outer dashed overlay, individual cards now highlighted */}
      
      <HandGrid
        ownerId={player.id}
        hand={handToDisplay}
        isOpponent={!isLocalPlayer}
        canInteract={canInteract}
        onCardClick={(_, index) => onCardClick(index)}
        selectedCardIndices={selectedCardIndex !== null ? [selectedCardIndex] : []}
        highlightedCardIndices={getHighlightedIndices()}
        initialPeekHighlight={isInitialPeek && isLocalPlayer}
      />
    </div>
  );
};

export default PlayerHand;