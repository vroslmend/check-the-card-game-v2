import { Card, Suit, CardRank } from 'shared-types';
import { nanoid } from 'nanoid';

// Helper function to create a standard 52-card deck
export const createDeck = (): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(CardRank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: nanoid(), suit, rank });
    }
  }
  return deck;
};

// Helper function to shuffle the deck
export const shuffleDeck = (deck: Card[]): Card[] => {
  // Fisher-Yates (Knuth) Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};