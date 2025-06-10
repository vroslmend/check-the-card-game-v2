'use client';

import React from 'react';
import { Card as CardType } from 'shared-types';
import { PlayingCard } from './PlayingCard';
import { CardBack } from '../ui/CardBack';

type DeckCardProps = {
  card?: CardType | { facedown: true } | null;
  count?: number;
};

// Type guard to check if a card is a face-up card
function isFaceUpCard(card: DeckCardProps['card']): card is CardType {
  return !!card && 'suit' in card;
}

// A generic component to represent a card on the table, which could be
// the deck, the discard pile, or another player's card.
export const DeckCard = ({ card, count }: DeckCardProps) => {
  return (
    <div className="relative h-48 w-32">
      {/* If there's a face-up card, show it */}
      {isFaceUpCard(card) ? (
        <PlayingCard card={card} className="absolute inset-0" />
      ) : (
        // Otherwise, show the card back
        <>
          <CardBack size="lg" />
          {count !== undefined && (
            <span className="absolute bottom-2 right-2 text-xs font-mono bg-white/20 rounded-full px-2 py-1 z-10">
              {count}
            </span>
          )}
        </>
      )}
    </div>
  );
}; 