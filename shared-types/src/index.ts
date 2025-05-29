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

export const cardValues: { [key in Rank]: number } = {
  [Rank.Ace]: 1,
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 10,
  [Rank.Queen]: 10,
  [Rank.King]: 0, // Or 10, depending on rules for King value if not checking
};

// Example of how you might represent a specific card:
// const aceOfSpades: Card = { suit: Suit.Spades, rank: Rank.Ace }; 

export interface SpecialAbilityInfo {
  card: Card;
  source: 'deck' | 'discard' | 'stack' | 'stackSecondOfPair'; // 'deck' implies drawn for ability
}

export interface PlayerState {
  hand: Card[];
  hasUsedInitialPeek: boolean;
  isReadyForInitialPeek: boolean;      // New: Player has clicked "Ready" for initial peek
  hasCompletedInitialPeek: boolean;    // New: Player has seen the peek and acknowledged
  pendingDrawnCard: Card | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  pendingSpecialAbility: SpecialAbilityInfo | null;
  hasCalledCheck: boolean;
  isLocked: boolean; // Player is locked after calling Check or emptying hand
  score: number; // Score for the current round
  // id: string; // playerID is the key in G.players, not stored here
}

export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  discardPileIsSealed: boolean;
  matchingOpportunityInfo: {
    cardToMatch: Card;
    originalPlayerID: string;
  } | null;
  playerWhoCalledCheck: string | null;
  roundWinner: string | null;
  finalTurnsTaken: number;
  lastResolvedAbilitySource: SpecialAbilityInfo['source'] | null; // Use the source type from SpecialAbilityInfo
  initialPeekAllReadyTimestamp: number | null;
  lastPlayerToResolveAbility: string | null;
  lastResolvedAbilityCardForCleanup: Card | null;
} 