"use client"

import { PlayingCard } from "@/components/cards/PlayingCard"
import type { Card, PlayerId, PublicCard } from "shared-types"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useUISelector } from '@/context/GameUIContext';

export interface HandGridProps {
  ownerId: PlayerId
  hand: PublicCard[]
  canInteract: boolean
  onCardClick?: (card: PublicCard, index: number) => void
  selectedCardIndices?: number[]
  className?: string
  cardSize?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
}

export const HandGrid = ({
  ownerId,
  hand,
  canInteract,
  onCardClick,
  selectedCardIndices = [],
  className,
  cardSize = 'xs',
}: HandGridProps) => {
  const firstRow = hand.slice(0, 2);
  const secondRow = hand.slice(2, 4);

  // Grab ability context to style peek / swap selections
  const abilitySelectionInfo = useUISelector((state) => {
    const ability = state.context.currentAbilityContext;
    return {
      stage: ability?.stage ?? null,
      selectedPeekTargets: ability?.selectedPeekTargets ?? [],
      selectedSwapTargets: ability?.selectedSwapTargets ?? [],
    };
  });

  const renderCard = (card: PublicCard, originalIndex: number) => {
    const cardKey = 'facedown' in card ? `${ownerId}-facedown-${originalIndex}` : `${ownerId}-${card.suit}-${card.rank}-${originalIndex}`;
    const isMatchSelected = selectedCardIndices.includes(originalIndex);
    
    const isAbilityPeekSelected = abilitySelectionInfo.stage === 'peeking' && abilitySelectionInfo.selectedPeekTargets.some(t => t.playerId === ownerId && t.cardIndex === originalIndex);
    const isAbilitySwapSelected = abilitySelectionInfo.stage === 'swapping' && abilitySelectionInfo.selectedSwapTargets.some(t => t.playerId === ownerId && t.cardIndex === originalIndex);

    const abilityRingClass = isAbilityPeekSelected ? 'ring-yellow-400' : (isAbilitySwapSelected ? 'ring-pink-500' : '');

    const isSelected = isMatchSelected || isAbilityPeekSelected || isAbilitySwapSelected;
    
    const layoutId = card.id ?? `${ownerId}-${originalIndex}`;

    return (
      <motion.div
        key={cardKey}
        layoutId={layoutId}
        className={cn(
          "relative flex items-center justify-center",
          cardSize === 'xxs' && 'min-w-[48px] min-h-[70px]',
          cardSize === 'xs' && 'min-w-[64px] min-h-[88px]',
          cardSize === 'sm' && 'min-w-[80px] min-h-[112px]',
          cardSize === 'md' && 'min-w-[96px] min-h-[144px]',
          cardSize === 'lg' && 'min-w-[112px] min-h-[160px]',
          canInteract && "cursor-pointer",
          // Matching selection indicator (sky)
          isMatchSelected && "ring-4 ring-offset-2 ring-offset-stone-900 ring-sky-400 rounded-lg dark:ring-offset-stone-900",
          // Ability selection indicators
          (isAbilityPeekSelected || isAbilitySwapSelected) && cn("ring-4 ring-offset-2 ring-offset-stone-900 rounded-lg dark:ring-offset-stone-900", abilityRingClass),
        )}
        onClick={() => canInteract && onCardClick?.(card, originalIndex)}
        whileHover={canInteract ? { y: -8, scale: 1.05 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <PlayingCard
          card={'facedown' in card ? undefined : card}
          faceDown={'facedown' in card}
          className="card-fluid"
          size={cardSize}
        />
      </motion.div>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1",
        className
      )}
    >
      <div className="flex flex-row gap-1">
        {firstRow.map((card, index) => renderCard(card, index))}
      </div>
      {secondRow.length > 0 && (
        <div className="flex flex-row gap-1">
          {secondRow.map((card, index) => renderCard(card, index + 2))}
        </div>
      )}
    </div>
  )
} 