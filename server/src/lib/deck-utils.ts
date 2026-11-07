import { Card, Suit, CardRank } from "shared-types";
import { type Rng, systemRng } from "./rng.js";

export const createDeck = (rng: Rng = systemRng): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(CardRank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: rng.id(), suit, rank });
    }
  }
  return deck;
};

const cardScoreValues: Record<CardRank, number> = {
  [CardRank.Ace]: -1,
  [CardRank.Two]: 2,
  [CardRank.Three]: 3,
  [CardRank.Four]: 4,
  [CardRank.Five]: 5,
  [CardRank.Six]: 6,
  [CardRank.Seven]: 7,
  [CardRank.Eight]: 8,
  [CardRank.Nine]: 9,
  [CardRank.Ten]: 10,
  [CardRank.Jack]: 11,
  [CardRank.Queen]: 12,
  [CardRank.King]: 13,
};

export const scoreHand = (hand: (Card | null)[]): number =>
  hand.reduce(
    (total, card) => total + (card ? cardScoreValues[card.rank] : 0),
    0,
  );

export const shuffleDeck = (deck: Card[], rng: Rng = systemRng): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.float() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
