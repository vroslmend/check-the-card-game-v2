// This file contains all the shared types for the Check card game application.
// By keeping them in a separate package, we can ensure that the client and server
// have a consistent understanding of the data structures being passed between them.

// ================================================================================================
//                                      CORE ID & STATE TYPES
// ================================================================================================
export type PlayerId = string;
export type GameId = string;

// A generic type for a persisted XState snapshot. The client receives this on game
// creation to hydrate its own state machine.
// eslint-disable-next-line @typescript-eslint/ban-types
export type PersistedState = object;


// ================================================================================================
//                                      GAME ENUMERATIONS
// ================================================================================================
export enum GameStage {
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  DEALING = 'DEALING',
  PLAYING = 'PLAYING',
  CHECK = 'CHECK',
  GAMEOVER = 'GAMEOVER',
}

export enum TurnPhase {
  DRAW = 'DRAW',
  DISCARD = 'DISCARD',
  ACTION = 'ACTION',
  ABILITY = 'ABILITY',
}

export enum PlayerStatus {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  CALLED_CHECK = 'CALLED_CHECK',
  WINNER = 'WINNER',
  LOSER = 'LOSER',
}


// ================================================================================================
//                                      CARD & DECK TYPES
// ================================================================================================
export interface Card {
  suit: Suit;
  rank: CardRank;
}

export enum Suit {
  Hearts = 'H', Diamonds = 'D', Clubs = 'C', Spades = 'S',
}

export enum CardRank {
  Ace = 'A', Two = '2', Three = '3', Four = '4', Five = '5',
  Six = '6', Seven = '7', Eight = '8', Nine = '9', Ten = 'T',
  Jack = 'J', Queen = 'Q', King = 'K',
}


// ================================================================================================
//                                      PLAYER & GAME STATE
// ================================================================================================

/**
 * Represents a player as seen by other clients. Hand is redacted.
 */
export interface Player {
  id: PlayerId;
  name: string;
  hand: (Card | { facedown: true })[];
  status: PlayerStatus;
  isReady: boolean;
  isDealer: boolean;
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  isConnected: boolean;
  pendingDrawnCard: Card | { facedown: true } | null;
}

/**
 * The redacted, client-safe version of the game's state.
 * This is the primary data structure the client will use to render the game.
 */
export interface ClientCheckGameState {
  gameId: GameId;
  viewingPlayerId: PlayerId;
  players: Record<PlayerId, Player>;
  deckSize: number;
  discardPile: Card[];
  turnOrder: PlayerId[];
  gameStage: GameStage;
  currentPlayerId: PlayerId | null;
  turnPhase: TurnPhase | null;
  activeAbility: ActiveAbility | null; // <-- ADDED FOR ABILITY UI
  checkDetails: {
    callerId: PlayerId | null;
  } | null;
  gameover: {
    winnerId: PlayerId | null;
    loserId: PlayerId | null;
    playerScores: Record<PlayerId, number>;
  } | null;
  lastRoundLoserId: PlayerId | null;
  log: RichGameLogMessage[];
  chat: ChatMessage[];
}


// ================================================================================================
//                                    SOCKETS & COMMS
// ================================================================================================

export enum SocketEventName {
  CREATE_GAME = 'CREATE_GAME',
  JOIN_GAME = 'JOIN_GAME',
  PLAYER_ACTION = 'PLAYER_ACTION',
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  ERROR_MESSAGE = 'ERROR_MESSAGE',
  ATTEMPT_REJOIN = 'ATTEMPT_REJOIN',
  SEND_CHAT_MESSAGE = 'SEND_CHAT_MESSAGE',
  SERVER_LOG_ENTRY = 'SERVER_LOG_ENTRY',
  INITIAL_LOGS = 'INITIAL_LOGS',
  // Server -> Client: Sent to a single player with the results of their peek
  ABILITY_PEEK_RESULT = 'ABILITY_PEEK_RESULT',
}

export interface BasicResponse {
  success: boolean;
  message?: string;
}

export interface CreateGameResponse extends BasicResponse {
  gameId?: GameId;
  playerId?: PlayerId;
  gameState?: PersistedState;
}

export interface JoinGameResponse extends BasicResponse {
  gameId?: GameId;
  playerId?: PlayerId;
  gameState?: ClientCheckGameState;
}

export interface AttemptRejoinResponse extends BasicResponse {
  gameId?: GameId;
  playerId?: PlayerId;
  gameState?: ClientCheckGameState;
}

export interface InitialPlayerSetupData {
  name: string;
  id?: string;
  socketId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: PlayerId;
  senderName: string;
  message: string;
  timestamp: string; // ISO 8601 format
}


// ================================================================================================
//                                    LOGGING & ACTIONS
// ================================================================================================

export interface RichGameLogMessage {
  id: string;
  timestamp: string;
  message: string;
  type: 'public' | 'private';
  tags: ('game-event' | 'player-action' | 'system-message' | 'error' | 'ability')[];
  payload?: Record<string, unknown>;
  actor?: {
    id: PlayerId;
    name: string;
  };
}

export enum PlayerActionType {
  // Turn Actions
  DRAW_FROM_DECK = 'DRAW_FROM_DECK',
  DRAW_FROM_DISCARD = 'DRAW_FROM_DISCARD',
  SWAP_AND_DISCARD = 'SWAP_AND_DISCARD',
  DISCARD_DRAWN_CARD = 'DISCARD_DRAWN_CARD',

  // Matching
  ATTEMPT_MATCH = 'ATTEMPT_MATCH',
  PASS_ON_MATCH_ATTEMPT = 'PASS_ON_MATCH_ATTEMPT',

  // Game Actions
  CALL_CHECK = 'CALL_CHECK',
  DECLARE_READY_FOR_PEEK = 'DECLARE_READY_FOR_PEEK',

  // Ability Resolution
  USE_ABILITY = 'USE_ABILITY',
}

// ================================================================================================
//                                    ABILITIES
// ================================================================================================

export type AbilityType = 'peek' | 'swap';

export interface PeekTarget {
  playerId: PlayerId;
  cardIndex: number;
}

export interface SwapTarget extends PeekTarget {}

// This represents an ability that is currently being resolved.
// It's part of the public game state so the UI can show a "resolving ability" state,
// but the sensitive `peekedCards` data is sent privately.
export interface ActiveAbility {
  type: AbilityType;
  stage: 'peeking' | 'swapping' | 'done';
  playerId: PlayerId; // The player using the ability
}

export type PeekAbilityPayload = {
  type: 'peek';
  targetPlayerId: PlayerId;
  cardIndex: number;
};

export type SwapAbilityPayload = {
  type: 'swap';
  sourcePlayerId: PlayerId;
  sourceCardIndex: number;
  targetPlayerId: PlayerId;
  targetCardIndex: number;
};

// This is the payload for the SUBMIT_ABILITY_* actions
export type AbilityPayload = PeekAbilityPayload | SwapAbilityPayload;

// ================================================================================================
//                                    CLIENT-SPECIFIC STATE
// ================================================================================================
// This is not a shared game state, but a type for the UI machine's internal context
// to manage an ongoing ability interaction.
export interface ClientAbilityContext {
  type: AbilityType;
  stage: 'peeking' | 'swapping' | 'done';
  maxPeekTargets: number;
  selectedPeekTargets: PeekTarget[];
  peekedCards?: (PeekTarget & { card: Card })[];
  selectedSwapTargets: SwapTarget[];
  playerId: PlayerId;
}