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
    source: 'draw' | 'discard'; // How it was triggered
    // Optionally, more fields for ability resolution
  } | null;
  // We might add fields like: score: number etc. later
}

export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  // We will add currentPhase, etc. here or let boardgame.io manage it via ctx
}

// Example of how you might represent a specific card:
// const aceOfSpades: Card = { suit: Suit.Spades, rank: Rank.Ace }; 