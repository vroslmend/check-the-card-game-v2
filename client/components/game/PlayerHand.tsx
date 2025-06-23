"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { HandGrid } from "./HandGrid";
import { type Player, type Card, type PublicCard } from "shared-types";
import { cn } from "@/lib/utils";

interface PlayerHandProps {
  player: Player;
  isLocalPlayer: boolean;
  onCardClick: (cardIndex: number) => void;
  className?: string;
  canInteract: boolean;
  isLocked?: boolean;
  selectedCardIndex?: number | null;
  cardSize?: "xxs" | "xs" | "sm" | "md" | "lg";
}

const selectVisibleCards = (state: UIMachineSnapshot) =>
  state.context.visibleCards;

const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isLocalPlayer,
  onCardClick,
  className,
  canInteract,
  isLocked = false,
  selectedCardIndex = null,
  cardSize = "xs",
}) => {
  const visibleCards = useUISelector(selectVisibleCards);

  const handToDisplay = isLocalPlayer
    ? player.hand.map((card, index) => {
        const isVisible = visibleCards.some(
          (vc) => vc.playerId === player.id && vc.cardIndex === index,
        );
        if (isVisible && "rank" in card) {
          return card;
        }
        return { facedown: true as const, id: card.id };
      })
    : player.hand;

  const combinedClass = cn(className, isLocked && "grayscale opacity-60");

  return (
    <HandGrid
      ownerId={player.id}
      hand={handToDisplay}
      canInteract={canInteract && !isLocked}
      onCardClick={(_, index) => onCardClick(index)}
      selectedCardIndices={
        selectedCardIndex !== null ? [selectedCardIndex] : []
      }
      className={combinedClass}
      cardSize={cardSize}
    />
  );
};

export default PlayerHand;
