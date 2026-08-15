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

export const shuffleDeck = (deck: Card[], rng: Rng = systemRng): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.float() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
