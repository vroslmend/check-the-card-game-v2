'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ClientCard, Card as CardType } from 'shared-types';
import { PlayingCard } from './BasicCardRenderer';

// Type guard to check if a card is a face-up card
function isFaceUpCard(card: ClientCard | null | undefined): card is CardType {
  return !!card && 'suit' in card && 'rank' in card;
}

// A generic component to represent a card on the table, which could be
// the deck, the discard pile, or another player's card.
export const DeckCard = ({ card, count }: { card?: ClientCard | null; count?: number }) => {
  return (
    <div className="relative h-48 w-32">
      {/* If there's a card, show it */}
      {isFaceUpCard(card) ? (
        <PlayingCard card={card} className="absolute inset-0" />
      ) : (
        // If there's no card (i.e., it's a face-down pile), show the card back
        <Card className="absolute inset-0 flex items-center justify-center bg-blue-800 border-blue-900">
          <CardContent className="flex flex-col items-center justify-center text-white">
            <span className="text-2xl font-bold">CHECK</span>
            {count !== undefined && (
              <span className="absolute bottom-2 right-2 text-xs font-mono bg-white/20 rounded-full px-2 py-1">
                {count}
              </span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 