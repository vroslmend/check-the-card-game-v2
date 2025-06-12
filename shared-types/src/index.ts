// This file contains all the shared types for the Check card game application.
// By keeping them in a separate package, we can ensure that the client and server
// have a consistent understanding of the data structures being passed between them.

// ================================================================================================
//                                      CORE ID & STATE TYPES
// ================================================================================================
export type PlayerId = string;
export type GameId = string;

// ================================================================================================
//                                      GAME ENUMERATIONS
// ================================================================================================
export enum GameStage {
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  DEALING = 'DEALING',
  INITIAL_PEEK = 'INITIAL_PEEK',
  PLAYING = 'PLAYING',
  FINAL_TURNS = 'FINAL_TURNS',
  SCORING = 'SCORING',
  GAMEOVER = 'GAMEOVER',
}

export enum TurnPhase {
  DRAW = 'DRAW',
  DISCARD = 'DISCARD',
  MATCHING = 'MATCHING',
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
  id: string;
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
  gameMasterId: PlayerId | null;
  players: Record<PlayerId, Player>;
  deckSize: number;
  discardPile: Card[];
  turnOrder: PlayerId[];
  gameStage: GameStage;
  currentPlayerId: PlayerId | null;
  turnPhase: TurnPhase | null;
  abilityStack: ActiveAbility[];
  matchingOpportunity: {
    cardToMatch: Card;
    originalPlayerID: PlayerId;
    remainingPlayerIDs: PlayerId[];
  } | null;
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
  discardPileIsSealed: boolean;
}


// ================================================================================================
//                                    SOCKETS & COMMS
// ================================================================================================

export interface ServerToClientEvents {
  [SocketEventName.GAME_STATE_UPDATE]: (gameState: ClientCheckGameState) => void;
  [SocketEventName.SERVER_LOG_ENTRY]: (logMessage: RichGameLogMessage) => void;
  [SocketEventName.INITIAL_PEEK_INFO]: (data: { hand: Card[] }) => void;
  [SocketEventName.ABILITY_PEEK_RESULT]: (payload: { card: Card; playerId: PlayerId; cardIndex: number }) => void;
  [SocketEventName.INITIAL_LOGS]: (logs: RichGameLogMessage[]) => void;
  [SocketEventName.ERROR_MESSAGE]: (error: { message: string }) => void;
  // FIX: Added event for server broadcasting a new chat message
  [SocketEventName.NEW_CHAT_MESSAGE]: (chatMessage: ChatMessage) => void;
}

export interface ClientToServerEvents {
  [SocketEventName.CREATE_GAME]: (payload: InitialPlayerSetupData, callback: (response: CreateGameResponse) => void) => void;
  [SocketEventName.JOIN_GAME]: (gameId: string, playerSetupData: InitialPlayerSetupData, callback: (response: JoinGameResponse) => void) => void;
  [SocketEventName.ATTEMPT_REJOIN]: (payload: { gameId: string; playerId: string }, callback: (response: AttemptRejoinResponse) => void) => void;
  [SocketEventName.PLAYER_ACTION]: (payload: { type: PlayerActionType; payload?: any }) => void;
  [SocketEventName.SEND_CHAT_MESSAGE]: (payload: { message: string; senderId: string; senderName: string; gameId: string; }) => void;
}

export type ServerToClientEventName = keyof ServerToClientEvents;

export enum SocketEventName {
  CREATE_GAME = 'CREATE_GAME',
  JOIN_GAME = 'JOIN_GAME',
  PLAYER_ACTION = 'PLAYER_ACTION',
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  ERROR_MESSAGE = 'ERROR_MESSAGE',
  ATTEMPT_REJOIN = 'ATTEMPT_REJOIN',
  SEND_CHAT_MESSAGE = 'SEND_CHAT_MESSAGE',
  INITIAL_PEEK_INFO = 'INITIAL_PEEK_INFO',
  ABILITY_PEEK_RESULT = 'ABILITY_PEEK_RESULT',
  SERVER_LOG_ENTRY = 'SERVER_LOG_ENTRY',
  INITIAL_LOGS = 'INITIAL_LOGS',
  // FIX: Added event name for server broadcasting a new chat message
  NEW_CHAT_MESSAGE = 'NEW_CHAT_MESSAGE',
}

export interface BasicResponse {
  success: boolean;
  message?: string;
}

export interface CreateGameResponse extends BasicResponse {
  gameId?: GameId;
  playerId?: PlayerId;
  gameState?: ClientCheckGameState;
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
  logs?: RichGameLogMessage[];
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
  // Lobby
  START_GAME = 'START_GAME',
  DECLARE_LOBBY_READY = 'DECLARE_LOBBY_READY',
  LEAVE_GAME = 'LEAVE_GAME',
  REMOVE_PLAYER = 'REMOVE_PLAYER',
  
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
  PLAY_AGAIN = 'PLAY_AGAIN',

  // Ability Resolution
  USE_ABILITY = 'USE_ABILITY',

  // Misc
  SEND_CHAT_MESSAGE = 'SEND_CHAT_MESSAGE',
}

// ================================================================================================
//                                    ABILITIES
// ================================================================================================

export type AbilityType = 'peek' | 'swap' | 'king';

export interface PeekTarget {
  playerId: PlayerId;
  cardIndex: number;
}

export interface SwapTarget {
  playerId: PlayerId;
  cardIndex: number;
}

export interface ActiveAbility {
  type: AbilityType;
  stage: 'peeking' | 'swapping' | 'done';
  playerId: PlayerId;
  sourceCard: Card;
}

export type PeekAbilityPayload = {
  action: 'peek';
  targets: {
    playerId: PlayerId;
    cardIndex: number;
  }[];
};

export type SwapAbilityPayload = {
  action: 'swap';
  source: {
    playerId: PlayerId;
    cardIndex: number;
  };
  target: {
    playerId: PlayerId;
    cardIndex: number;
  };
  sourceCard: Card;
};

export type SkipAbilityPayload = {
  action: 'skip';
};

export type AbilityActionPayload = PeekAbilityPayload | SwapAbilityPayload | SkipAbilityPayload;

// ================================================================================================
//                                    CLIENT-SPECIFIC STATE
// ================================================================================================
export interface ClientAbilityContext {
  type: AbilityType;
  stage: 'peeking' | 'swapping' | 'done';
  sourceCard: Card;
  maxPeekTargets: number;
  selectedPeekTargets: PeekTarget[];
  peekedCards?: (PeekTarget & { card: Card })[];
  maxSwapTargets: number;
  selectedSwapTargets: SwapTarget[];
  validPeekTargets?: PeekTarget[];
  validSwapTargets?: SwapTarget[];
  playerId: PlayerId;
}