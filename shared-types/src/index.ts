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
  id?: string; // Make id optional for React keys, added by server when sending to client
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
  isReadyForInitialPeek: boolean;
  hasCompletedInitialPeek: boolean;
  cardsToPeek: Card[] | null;
  peekAcknowledgeDeadline: number | null;
  pendingDrawnCard: Card | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  pendingSpecialAbility: SpecialAbilityInfo | null;
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  name?: string;
  isConnected: boolean;
  socketId: string;
  numMatches: number;
  numPenalties: number;
}

// Define GamePhase type
export type GamePhase =
  | 'initialPeekPhase'
  | 'playPhase'
  | 'matchingStage'
  | 'abilityResolutionPhase'
  | 'finalTurnsPhase'
  | 'scoringPhase'
  | 'gameOver'
  | 'error' // For error states
  | 'errorOrStalemate'; // For unrecoverable game states

// Define MatchResolvedDetails interface
export interface MatchResolvedDetails {
  byPlayerId: string; // Who made the successful match
  isAutoCheck: boolean; // Did this match result in an auto-check?
  abilityResolutionRequired: boolean; // Does this match trigger special abilities?
}

// Data structure for game over information - DEFINED FIRST
export interface GameOverData {
  winner?: string | string[];
  scores: { [playerId: string]: number };
  finalHands?: { [playerId: string]: Card[] };
  totalTurns?: number;
  playerStats?: {
    [playerId: string]: {
      name: string; // Server will populate this from PlayerState
      numMatches: number;
      numPenalties: number;
    };
  };
}

export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  discardPileIsSealed: boolean;
  matchingOpportunityInfo: {
    cardToMatch: Card;
    originalPlayerID: string;
    potentialMatchers: string[];
  } | null;
  playerWhoCalledCheck: string | null;
  roundWinner: string | null;
  finalTurnsTaken: number;
  initialPeekAllReadyTimestamp: number | null;
  lastPlayerToResolveAbility: string | null;
  lastResolvedAbilitySource: SpecialAbilityInfo['source'] | null;
  lastResolvedAbilityCardForCleanup: Card | null;
  currentPhase: GamePhase;
  currentPlayerId: string;
  turnOrder: string[];
  gameMasterId: string;
  activePlayers: { [playerID: string]: string };
  pendingAbilities: PendingSpecialAbility[];
  matchResolvedDetails: MatchResolvedDetails | null;
  gameover: GameOverData | null; // Uses the above defined GameOverData
  totalTurnsInRound: number;
  globalAbilityTargets?: Array<{ playerID: string; cardIndex: number; type: 'peek' | 'swap' }> | null;
  lastRegularSwapInfo: LastRegularSwapInfo | null;
}

// Data structure for players joining a game or being set up initially
export interface InitialPlayerSetupData {
  id: string; // Unique player identifier (e.g., socket.id or a persistent user ID)
  name?: string; // Optional display name for the player
  socketId?: string; // For server to associate player with initial socket during game creation
}

export interface PendingSpecialAbility {
  playerId: string;
  card: Card;
  source: 'deck' | 'discard' | 'stack' | 'stackSecondOfPair';
  pairTargetId?: string; // For 'stackSecondOfPair', who was the other player in the stack
  currentAbilityStage?: 'peek' | 'swap'; // Added to track K/Q multi-stage abilities
}

export interface LastRegularSwapInfo {
  playerId: string;    // The player who performed the swap
  handIndex: number;   // The index in their hand that was swapped
  timestamp: number;   // Timestamp of when the swap occurred (Date.now())
}

// --- Client-Specific Types for Redaction ---

export interface HiddenCard {
  isHidden: true;
  id: string; // For React keys, e.g., "hidden-0", "hidden-1"
}

export type ClientCard = Card | HiddenCard;

export interface ClientPlayerState {
  hand: ClientCard[];
  hasUsedInitialPeek: boolean;
  isReadyForInitialPeek: boolean;
  hasCompletedInitialPeek: boolean;
  cardsToPeek: Card[] | null;
  peekAcknowledgeDeadline: number | null;
  pendingDrawnCard: ClientCard | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  pendingSpecialAbility: SpecialAbilityInfo | null;
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  name?: string;
  isConnected: boolean;
  numMatches: number;
  numPenalties: number;
  explicitlyRevealedCards?: { [cardIndex: number]: Card };
}

// Client-specific game over data - DEFINED FIRST (before ClientCheckGameState)
export interface ClientGameOverData extends Omit<GameOverData, 'finalHands' | 'playerStats'> {
  finalHands?: { [playerId: string]: ClientCard[] };
  playerStats?: {
    [playerId: string]: {
      name: string; // Name here comes from ClientPlayerState potentially
      numMatches: number;
      numPenalties: number;
    };
  };
  // totalTurns is inherited correctly via Omit from GameOverData
}

export interface ClientCheckGameState extends Omit<CheckGameState, 'deck' | 'players' | 'gameover' | 'lastResolvedAbilitySource' | 'lastResolvedAbilityCardForCleanup'> {
  deckSize: number;
  players: { [playerID: string]: ClientPlayerState };
  topDiscardIsSpecialOrUnusable?: boolean;
  gameover: ClientGameOverData | null; // Uses the above defined ClientGameOverData
  viewingPlayerId: string;
  globalAbilityTargets?: Array<{ playerID: string; cardIndex: number; type: 'peek' | 'swap' }> | null;
  lastRegularSwapInfo: LastRegularSwapInfo | null;
}

// Represents a card that a player has chosen to use for its special ability
// ... existing code ...

// Data structure for game over information
export interface GameOverData {
  winner?: string | string[]; // Can be single or multiple winners (draw)
  scores: { [playerId: string]: number };
  finalHands?: { [playerId: string]: Card[] }; // Optional: if we want to show final hands
  totalTurns?: number; // New stat
  playerStats?: { // New stat
    [playerId: string]: {
      name: string;
      numMatches: number;
      numPenalties: number;
    };
  };
} 