"use client";

import React from "react";
import { PlayingCard, cardSizeClasses } from "../cards/PlayingCard";
import type { PublicCard } from "shared-types";

interface DrawnCardAreaProps {
  card: PublicCard;
  size?: keyof typeof cardSizeClasses;
}

export const DrawnCardArea = ({ card, size = "xs" }: DrawnCardAreaProps) => {
  const isFaceUp = "rank" in card;

  return (
    <PlayingCard
      card={isFaceUp ? card : undefined}
      faceDown={!isFaceUp}
      className="card-fluid"
      size={size}
    />
  );
};
