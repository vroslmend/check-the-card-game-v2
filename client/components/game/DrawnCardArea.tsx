"use client";

import React from "react";
import { PlayingCard, cardSizeClasses } from "../cards/PlayingCard";
import type { PublicCard } from "shared-types"; // ✨ 1. Import PublicCard

// ✨ 2. Update the interface to accept PublicCard
interface DrawnCardAreaProps {
  card: PublicCard;
  size?: keyof typeof cardSizeClasses;
}

export const DrawnCardArea = ({ card, size = "xs" }: DrawnCardAreaProps) => {
  // ✨ 3. Add logic to check if the card is face up or face down
  const isFaceUp = "rank" in card;

  return (
    <PlayingCard
      // If it's face up, pass the full card object. If not, pass undefined.
      card={isFaceUp ? card : undefined}
      // Tell the PlayingCard component explicitly whether to show its back.
      faceDown={!isFaceUp}
      className="card-fluid"
      size={size}
    />
  );
};
