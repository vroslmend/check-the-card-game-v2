'use client';

import React, { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { HandGrid } from './HandGrid';
import { type Player, TurnPhase, GameStage, type ClientAbilityContext, type PeekTarget, type SwapTarget } from 'shared-types';
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
  const { actorRef } = useContext(UIContext)!;
  const { baseCanInteract, gameStage, visibleCards } = useSelector(actorRef, selectPlayerHandProps);
  
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
      {isInitialPeek && isLocalPlayer && (
        <AnimatePresence>
          <motion.div 
            className="absolute -bottom-2 -inset-x-2 h-1/2 rounded-lg border border-dashed border-yellow-400 dark:border-yellow-500 z-0 flex items-end justify-center pb-1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: [0.3, 0.6, 0.3], 
              scale: 1,
            }}
            transition={{ 
              opacity: { repeat: Infinity, duration: 2 },
              scale: { duration: 0.5 }
            }}
          >
            <div className='flex items-center gap-1.5 text-yellow-500 dark:text-yellow-400 text-xs font-semibold'>
              <Eye className='w-3 h-3' />
              <span>Initial Peek</span>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
      
      <HandGrid
        ownerId={player.id}
        hand={handToDisplay}
        isOpponent={!isLocalPlayer}
        canInteract={canInteract}
        onCardClick={(_, index) => onCardClick(index)}
        selectedCardIndices={selectedCardIndex !== null ? [selectedCardIndex] : []}
        highlightedCardIndices={getHighlightedIndices()}
      />
    </div>
  );
};

export default PlayerHand;