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
  Ten = '10',
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

export interface SpecialAbilityInfo {
  card: Card;
  source: 'deck' | 'discard' | 'stack' | 'stackSecondOfPair'; // 'deck' implies drawn for ability
}

export interface PlayerState {
  hand: Card[];
  hasUsedInitialPeek: boolean;
  isReadyForInitialPeek: boolean;      // New: Player has clicked "Ready" for initial peek
  hasCompletedInitialPeek: boolean;    // New: Player has seen the peek and acknowledged
  cardsToPeek?: Card[] | null;         // Server sends these to the specific player during their peek turn
  peekAcknowledgeDeadline?: number | null; // Server sets this deadline for the player to acknowledge
  pendingDrawnCard: Card | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  pendingSpecialAbility: PendingSpecialAbility | null;
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
    potentialMatchers: string[]; // Players who can attempt a match
  } | null;
  playerWhoCalledCheck: string | null;
  roundWinner: string | null;
  finalTurnsTaken: number;
  lastResolvedAbilitySource: SpecialAbilityInfo['source'] | null; // Use the source type from SpecialAbilityInfo
  initialPeekAllReadyTimestamp: number | null;
  lastPlayerToResolveAbility: string | null;
  lastResolvedAbilityCardForCleanup: Card | null;

  // New fields to replace boardgame.io context
  currentPhase: string;
  currentPlayerId: string;
  turnOrder: string[];
  gameMasterId?: string; // Optional game master
  activePlayers: { [playerID: string]: string }; // Tracks active players and their current stage
  pendingAbilities?: PendingSpecialAbility[] | null; // Abilities waiting for resolution
  gameover?: { winner?: string; scores?: { [playerId: string]: number } } | null; // Standardized gameover structure

  // Details of a resolved match, used by checkMatchingStageEnd to determine next phase
  matchResolvedDetails: {
    byPlayerId: string; // Who made the successful match
    isAutoCheck: boolean;
    abilityResolutionRequired: boolean;
  } | null;
}

// Data structure for players joining a game or being set up initially
export interface InitialPlayerSetupData {
  id: string; // Unique player identifier (e.g., socket.id or a persistent user ID)
  name?: string; // Optional display name for the player
}

export interface PendingSpecialAbility {
  playerId: string; // The ID of the player whose ability this is
  card: Card;
  source: 'deck' | 'discard' | 'stack' | 'stackSecondOfPair'; // 'stack' for matcher, 'stackSecondOfPair' for original discarder
  pairTargetId?: string; // ID of the other player involved in a stack, if applicable
}

export interface MatchingOpportunityInfo {
  // ... existing code ...
} 

// --- Client-Specific Types for Redaction ---

export interface HiddenCard {
  isHidden: true;
  id: string; // For React keys, e.g., "hidden-0", "hidden-1"
}

export type ClientCard = Card | HiddenCard;

export interface ClientPlayerState {
  // Fields from PlayerState, but with redacted hand
  name?: string; // Player's display name
  hand: ClientCard[];
  hasUsedInitialPeek: boolean;
  isReadyForInitialPeek: boolean;
  hasCompletedInitialPeek: boolean;
  cardsToPeek?: Card[] | null; // Viewer sees their cards to peek
  peekAcknowledgeDeadline?: number | null; // Relevant for the viewer
  // pendingDrawnCard for the viewing player should be Card | null
  // for others, it should effectively be null or an indication of hidden card if that state is even sent to others
  pendingDrawnCard: ClientCard | null; // Viewer sees their card, others see null or HiddenCard
  // pendingDrawnCardSource is probably fine to send to all, or nullify for others
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  // pendingSpecialAbility: source might be okay, card details might need redaction if complex
  pendingSpecialAbility: PendingSpecialAbility | null; // Or a redacted version for others
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
}

export interface ClientCheckGameState {
  // Fields from CheckGameState, but with redactions
  deckSize: number; // Instead of the full deck array
  players: { [playerID: string]: ClientPlayerState };
  discardPile: Card[]; // Discard pile is usually public
  discardPileIsSealed: boolean;
  matchingOpportunityInfo: {
    cardToMatch: Card; // Card to match is public
    originalPlayerID: string;
    potentialMatchers: string[]; // Public info on who can match
  } | null;
  playerWhoCalledCheck: string | null;
  roundWinner: string | null;
  finalTurnsTaken: number;
  lastResolvedAbilitySource: SpecialAbilityInfo['source'] | null;
  initialPeekAllReadyTimestamp: number | null; 
  // lastPlayerToResolveAbility might be sensitive or not, TBD.
  // lastResolvedAbilityCardForCleanup definitely should not be sent to all.
  // For simplicity, these can be omitted from ClientCheckGameState initially
  // or handled carefully if needed by client logic beyond display.

  currentPhase: string;
  currentPlayerId: string;
  turnOrder: string[];
  gameMasterId?: string;
  activePlayers: { [playerID: string]: string };
  pendingAbilities?: PendingSpecialAbility[] | null; // List of abilities pending, card details might be sensitive if not for viewing player
  gameover?: { winner?: string; scores?: { [playerId: string]: number } } | null;
  
  // Details of a resolved match, used by checkMatchingStageEnd to determine next phase
  // This might be okay to send as is, as it reflects outcomes.
  matchResolvedDetails: {
    byPlayerId: string; 
    isAutoCheck: boolean;
    abilityResolutionRequired: boolean;
  } | null;

  // Specific to the client receiving this state
  viewingPlayerId: string; 
} 