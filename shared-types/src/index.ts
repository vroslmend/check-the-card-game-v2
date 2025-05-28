// This will be the entry point for your shared types
// You can export interfaces, enums, and types from here.
// For example:
// export * from './card.types'; 

export enum Suit {
  Hearts = 'H',
  Diamonds = 'D',
  Clubs = 'C',
  Spades = 'S',
}

export enum Rank {
  Ace = 'A',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = 'T',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  // Potentially add an 'id' if needed for unique identification on the client, e.g., for React keys
  // id: string;
}

export interface PlayerState {
  hand: Card[];
  hasUsedInitialPeek: boolean;
  pendingDrawnCard?: Card | null; // Card drawn but not yet swapped/discarded
  pendingDrawnCardSource?: 'deck' | 'discard' | null; // Source of the pending drawn card
  pendingSpecialAbility?: {
    card: Card; // The K/Q/J card
    source: 'draw' | 'discard' | 'stack' | 'stackSecondOfPair'; // How it was triggered
    // Optionally, more fields for ability resolution
  } | null;
  hasCalledCheck?: boolean; // True if the player has called "Check"
  isLocked?: boolean; // True if the player's hand is locked (after calling Check or emptying hand)
  score?: number; // Player's score for the round
  // We might add fields like: score: number etc. later
}

export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  discardPileIsSealed: boolean; // True if the top of the discard is the second card of a matched pair
  matchingOpportunityInfo?: {
    cardToMatch: Card; // The card on top of the discard pile that can be matched
    originalPlayerID: string; // The player who discarded the cardToMatch
  } | null;
  playerWhoCalledCheck?: string | null; // ID of the player who called "Check"
  roundWinner?: string | null; // ID(s) of the player(s) who won the round
  finalTurnsTaken?: number; // Counter for players who have taken their turn in finalTurnsPhase
  lastResolvedAbilitySource?: 'draw' | 'discard' | 'stack' | 'stackSecondOfPair' | null;
  // We will add currentPhase, etc. here or let boardgame.io manage it via ctx
}

export const cardValues: { [key in Rank]: number } = {
  [Rank.Ace]: -1,
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 11,
  [Rank.Queen]: 12,
  [Rank.King]: 13,
};

// Example of how you might represent a specific card:
// const aceOfSpades: Card = { suit: Suit.Spades, rank: Rank.Ace }; 