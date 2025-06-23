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
  selectedCardIndex = null,
  cardSize = "xs",
}) => {
  const visibleCards = useUISelector(selectVisibleCards);

  // For the local player, we have the full card data, but we need to decide
  // whether to show it as face-up or face-down. A card is only face-up if
  // it's in the `visibleCards` list. Otherwise, it's face-down.
  const handToDisplay = isLocalPlayer
    ? player.hand.map((card, index) => {
        const isVisible = visibleCards.some(
          (vc) => vc.playerId === player.id && vc.cardIndex === index,
        );
        // We must ensure the card object has a rank for it to be rendered face-up.
        if (isVisible && "rank" in card) {
          return card;
        }
        return { facedown: true as const, id: card.id };
      })
    : player.hand;

  return (
    <HandGrid
      ownerId={player.id}
      hand={handToDisplay}
      canInteract={canInteract}
      onCardClick={(_, index) => onCardClick(index)}
      selectedCardIndices={
        selectedCardIndex !== null ? [selectedCardIndex] : []
      }
      className={className}
      cardSize={cardSize}
    />
  );
};

export default PlayerHand;
