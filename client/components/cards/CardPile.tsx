"use client";

import React from "react";
import { type Card, type PublicCard } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

interface DeckCardProps {
  card?: PublicCard | null;
  className?: string;
  onClick?: () => void;
  isInteractive?: boolean;
}

function isFaceUpCard(card: DeckCardProps["card"]): card is Card {
  return !!card && "suit" in card;
}

export const DeckCard = ({
  card,
  className,
  onClick,
  isInteractive,
}: DeckCardProps) => {
  return (
    <div
      className={cn("relative aspect-[5/7]", className)}
      onClick={isInteractive ? onClick : undefined}
    >
      <PlayingCard
        card={isFaceUpCard(card) ? card : undefined}
        faceDown={!isFaceUpCard(card)}
        className="h-full w-full"
      />
    </div>
  );
};
