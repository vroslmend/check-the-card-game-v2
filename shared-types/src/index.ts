// This will be the entry point for your shared types
// You can export interfaces, enums, and types from here.
// For example:
// export * from './card.types'; 

export type PlayerId = string; // Added PlayerId type

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
  id: string; // Mandatory unique identifier for the card (e.g., "H_A" for Ace of Hearts). Essential for animations and React keys.
  isFaceDownToOwner?: boolean; // Server-side flag: if true, this card is hidden from its owner in their client view
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

export interface AbilityArgs { // This is from shared-types
  peekTargets?: Array<{ playerID: string; cardIndex: number }>;
  swapTargets?: Array<{ playerID: string; cardIndex: number }>;
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
  forfeited?: boolean;
}

// Define GamePhase type
export type GamePhase =
  | 'awaitingPlayers'
  | 'initialPeekPhase'
  | 'playPhase'
  | 'matchingStage'
  | 'abilityResolutionPhase'
  | 'finalTurnsPhase'
  | 'scoringPhase'
  | 'gameOver'
  | 'error' // For error states
  | 'errorOrStalemate'; // For unrecoverable game states

// Define TurnSegment type
export type TurnSegment = 'initialAction' | 'postDrawAction' | null;

// Define MatchResolvedDetails interface
export interface MatchResolvedDetails {
  byPlayerId: string; // Who made the successful match
  isAutoCheck: boolean; // Did this match result in an auto-check?
  abilityResolutionRequired: boolean; // Does this match trigger special abilities?
}

// Data structure for game over information - DEFINED FIRST
export interface GameOverData {
  winnerId: string | null;
  players: {
    id: string;
    score: number;
    hand: Card[];
  }[];
  scores?: { [playerId: string]: number };
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
  gameId: string;
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
  activePlayers: { [playerID: string]: PlayerActivityStatus };
  pendingAbilities: PendingSpecialAbility[];
  matchResolvedDetails: MatchResolvedDetails | null;
  gameover: GameOverData | null; // Uses the above defined GameOverData
  totalTurnsInRound: number;
  globalAbilityTargets?: Array<{ playerID: string; cardIndex: number; type: 'peek' | 'swap' }> | null;
  lastRegularSwapInfo: LastRegularSwapInfo | null;
  playerTimers?: {
    [playerId: string]: {
      turnTimerExpiresAt?: number;
      disconnectGraceTimerExpiresAt?: number;
    };
  };
  currentTurnSegment: TurnSegment; // Added new field
  matchingStageTimerExpiresAt?: number; // New field for matching stage timer
  disconnectGraceTimerExpiresAt?: number; // ADDED: For global grace timer tracking
  logHistory?: RichGameLogMessage[]; // Added for storing recent logs on server
}

// New Enum for Player Activity Status
export enum PlayerActivityStatus {
  AWAITING_READINESS = 'awaitingReadiness',
  PLAY_PHASE_ACTIVE = 'playPhaseActive',
  AWAITING_MATCH_ACTION = 'awaitingMatchAction',
  MATCH_ACTION_CONCLUDED = 'matchActionConcluded',
  ABILITY_RESOLUTION_ACTIVE = 'abilityResolutionActive',
  FINAL_TURN_ACTIVE = 'finalTurnActive',
  // Add any other distinct statuses used in activePlayers here
}

// Enum for custom socket event names
export enum SocketEventName {
  // Client to Server
  CREATE_GAME = 'CREATE_GAME',
  JOIN_GAME = 'JOIN_GAME',
  ATTEMPT_REJOIN = 'ATTEMPT_REJOIN',
  PLAYER_ACTION = 'PLAYER_ACTION',
  SEND_CHAT_MESSAGE = 'SEND_CHAT_MESSAGE',
  REQUEST_CARD_DETAILS_FOR_ABILITY = 'REQUEST_CARD_DETAILS_FOR_ABILITY',

  // Server to Client
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  PLAYER_JOINED = 'PLAYER_JOINED', // For broadcasting when a new player joins an existing game
  REJOIN_DENIED = 'REJOIN_DENIED', // Specific event if server denies a rejoin attempt
  SERVER_LOG_ENTRY = 'SERVER_LOG_ENTRY', // For individual log entries sent by the server
  INITIAL_LOGS = 'INITIAL_LOGS', // For the batch of logs sent when a player joins/rejoins
  CHAT_MESSAGE = 'CHAT_MESSAGE', // For broadcasting chat messages to clients
  GAME_LOG_MESSAGE = 'gameLogMessage', // Added for generic game log messages
  ERROR_MESSAGE = 'errorMessage', // Added for server-sent errors
  RESPOND_CARD_DETAILS_FOR_ABILITY = 'RESPOND_CARD_DETAILS_FOR_ABILITY',
  SERVER_EVENT = 'SERVER_EVENT'
}

// Payload Types for new Socket Events
export interface RequestCardDetailsPayload {
  targetPlayerId: PlayerId;
  cardIndex: number;
  gameId: string;
}

export interface RespondCardDetailsPayload {
  card: Card;
  playerId: PlayerId; // The player whose card is being revealed
  cardIndex: number;  // The index of the card in that player's hand
}

// Enum for player action types (payload for PLAYER_ACTION event)
export enum PlayerActionType {
  DRAW_FROM_DECK = 'drawFromDeck',
  DRAW_FROM_DISCARD = 'drawFromDiscard',
  SWAP_AND_DISCARD = 'swapAndDiscard',
  DISCARD_DRAWN_CARD = 'discardDrawnCard',
  ATTEMPT_MATCH = 'attemptMatch',
  PASS_ON_MATCH_ATTEMPT = 'passOnMatchAttempt',
  CALL_CHECK = 'callCheck',
  DECLARE_READY_FOR_PEEK = 'declareReadyForPeek',
  REQUEST_PEEK_REVEAL = 'requestPeekReveal',
  RESOLVE_SPECIAL_ABILITY = 'resolveSpecialAbility',
  RESET_GAME = 'resetGame',
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
  forfeited?: boolean;
  turnTimerExpiresAt?: number;
  disconnectGraceTimerExpiresAt?: number;
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
  currentTurnSegment: TurnSegment; // Ensure client also has this
  matchingStageTimerExpiresAt?: number; // New field for matching stage timer
  // logHistory will also be available here via Omit, client will receive a subset on join/rejoin
}

// Represents a card that a player has chosen to use for its special ability
// ... existing code ...

// Data structure for game over information
/* Duplicate GameOverData definition removed */

// New interface for structured log messages
export interface RichGameLogMessage {
  message: string;
  timestamp?: string; // Server will add this
  type?: 'system' | 'player_action' | 'game_event' | 'error' | 'info';
  actorName?: string; // e.g., player who performed the action
  targetName?: string; // e.g., player targeted by an action
  cardContext?: string; // e.g., "drew 7H", "discarded KD", "matched 5S"
  logId?: string; // Unique ID for the log entry

  // We can add more structured fields later, like card details or action specifics

  // New fields for sensitive logging
  isPublic?: boolean;       // Defaults to true. If false, this log is targeted.
  recipientPlayerId?: string; // If isPublic is false, this specifies the sole recipient.
  privateVersionRecipientId?: string; // If set on a public log, this player received a private version.
}

// New interface for Chat Messages
export interface ChatMessage {
  id: string; // Unique ID for the message (e.g., generated by client or server)
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string; // ISO string or formatted time string
  type?: 'lobby' | 'room'; // To distinguish context if needed
  gameId?: string; // Relevant if type is 'room'
}

// Game Machine Specific Types

export interface GameMachineContext extends CheckGameState {
  gameId: string;
  // Potentially other machine-specific, non-serializable state like actor refs if not using XState v5 features that handle this better.
  // For now, keeping it aligned with CheckGameState + gameId.
}

export type GameMachineInput = {
  gameId: string;
  // playerSetupDataArray?: InitialPlayerSetupData[]; // If initializing with players directly
};

// Base events from PlayerActionType
type PlayerActionEvents = {
  [K in PlayerActionType]: { type: K; playerId: string; } & // Common playerId
    (K extends PlayerActionType.SWAP_AND_DISCARD ? { handIndex: number } :
    K extends PlayerActionType.ATTEMPT_MATCH ? { handIndex: number } :
    K extends PlayerActionType.REQUEST_PEEK_REVEAL ? { peekTargets: Array<{ playerID: string; cardIndex: number }> } :
    K extends PlayerActionType.RESOLVE_SPECIAL_ABILITY ? { abilityResolutionArgs?: AbilityArgs & { skipAbility?: boolean; skipType?: 'peek' | 'swap' | 'full' } } :
    // Add other actions that have specific payloads here
    Record<string, any>) // Default for actions with no extra payload beyond playerId
};

export type ConcretePlayerActionEvents = PlayerActionEvents[PlayerActionType]; // Added export

// Events that the game machine can receive
export type GameMachineEvent =
  | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData }
  | { type: 'PLAYER_DECLARES_READY_FOR_PEEK'; playerId: string }
  | ConcretePlayerActionEvents // All events derived from PlayerActionType
  // Internal events
  | { type: 'PEEK_TIMER_EXPIRED' }
  | { type: 'MATCHING_STAGE_TIMER_EXPIRED' }
  | { type: 'TURN_TIMER_EXPIRED'; timedOutPlayerId: string }
  | { type: 'DISCONNECT_GRACE_TIMER_EXPIRED'; timedOutGracePlayerId: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'PLAYER_RECONNECTED'; playerId: string; newSocketId: string }
  | { type: '_HANDLE_FORFEITURE_CONSEQUENCES'; forfeitedPlayerId: string };

export type GameMachineEmittedEvents =
  | {
      type: 'EMIT_LOG_PUBLIC';
      gameId: string;
      publicLogData: Omit<RichGameLogMessage, 'timestamp' | 'actorName' | 'isPublic' | 'recipientPlayerId' | 'logId'> & {
        actorId?: string;
        cardContext?: string;
        targetName?: string;
      };
      privateLogConfig?: {
        recipientPlayerId: string;
        privateLogData: Omit<RichGameLogMessage, 'timestamp' | 'actorName' | 'isPublic' | 'recipientPlayerId' | 'logId'> & {
          actorId?: string;
          cardContext?: string;
          targetName?: string;
        };
      };
    }
  | {
      type: 'EMIT_LOG_PRIVATE';
      gameId: string;
      recipientPlayerId: string;
      privateLogData: Omit<RichGameLogMessage, 'timestamp' | 'actorName' | 'isPublic' | 'recipientPlayerId' | 'logId'> & {
        actorId?: string;
        cardContext?: string;
        targetName?: string;
      };
    }
  | { type: 'BROADCAST_GAME_STATE'; gameId: string }
  | { type: 'EMIT_GAME_OVER'; gameId: string; gameOverData: GameOverData };

// ==================================
// XState Machine Type Definitions
// ==================================
