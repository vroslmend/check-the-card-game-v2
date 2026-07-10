// ================================================================================================
//                                      CORE ID & STATE TYPES
// ================================================================================================
export type PlayerId = string;
export type GameId = string;

// ================================================================================================
//                                      GAME ENUMERATIONS
// ================================================================================================
export enum GameStage {
  WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
  DEALING = "DEALING",
  INITIAL_PEEK = "INITIAL_PEEK",
  PLAYING = "PLAYING",
  FINAL_TURNS = "FINAL_TURNS",
  SCORING = "SCORING",
  GAMEOVER = "GAMEOVER",
}

export enum TurnPhase {
  DRAW = "DRAW",
  DISCARD = "DISCARD",
  MATCHING = "MATCHING",
  ACTION = "ACTION",
  ABILITY = "ABILITY",
}

export enum PlayerStatus {
  WAITING = "WAITING",
  PLAYING = "PLAYING",
  CALLED_CHECK = "CALLED_CHECK",
  DISQUALIFIED = "DISQUALIFIED",
  WINNER = "WINNER",
  LOSER = "LOSER",
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
  Hearts = "H",
  Diamonds = "D",
  Clubs = "C",
  Spades = "S",
}

export enum CardRank {
  Ace = "A",
  Two = "2",
  Three = "3",
  Four = "4",
  Five = "5",
  Six = "6",
  Seven = "7",
  Eight = "8",
  Nine = "9",
  Ten = "T",
  Jack = "J",
  Queen = "Q",
  King = "K",
}

export interface FacedownCard {
  id: string;
  facedown: true;
}

export type PublicCard = Card | FacedownCard;

// ================================================================================================
//                                      PLAYER & GAME STATE
// ================================================================================================

/**
 * Represents a player as seen by other clients. Hand is redacted.
 */
export interface Player {
  id: PlayerId;
  name: string;
  hand: (PublicCard | null)[];
  status: PlayerStatus;
  isReady: boolean;
  isDealer: boolean;
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  isConnected: boolean;
  /** True when the player was dropped for failing to reconnect in time. */
  forfeited?: boolean;
  pendingDrawnCard: { card: PublicCard; source: "deck" | "discard" } | null;
}

/**
 * Which card positions are currently being peeked at, visible to ALL players
 * (real-life table parity: you can see which card someone lifts, not its
 * face). Card values are never included.
 */
export interface PublicPeekInfo {
  peekerId: PlayerId;
  targets: { playerId: PlayerId; cardIndex: number }[];
  startedAt: number;
}

/**
 * Which two card positions were just swapped by an ability, visible to ALL
 * players (real-life table parity: you can see which cards traded places,
 * never their faces). Momentary: clients hide it ~2.5s after occurredAt.
 */
export interface PublicSwapInfo {
  swapperId: PlayerId;
  targets: { playerId: PlayerId; cardIndex: number }[];
  occurredAt: number;
}

/**
 * The slot a failed-match PENALTY card just landed in, visible to ALL players
 * (real-life table parity: everyone sees a card was dealt into a hand and
 * where — never its face). Momentary: clients hide it a few seconds after
 * occurredAt.
 */
export interface PublicPenaltyInfo {
  playerId: PlayerId;
  cardIndex: number;
  occurredAt: number;
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
  /** Only the visible top of the pile (last =2 cards); use discardPileSize
   *  for the count. Broadcasting the whole pile grew every payload by the
   *  length of the game. */
  discardPile: Card[];
  discardPileSize: number;
  deckTop: FacedownCard | null;
  turnOrder: PlayerId[];
  gameStage: GameStage;
  currentPlayerId: PlayerId | null;
  turnPhase: TurnPhase | null;
  abilityStack: ActiveAbility[];
  matchingOpportunity: {
    cardToMatch: Card;
    originalPlayerID: PlayerId;
    remainingPlayerIDs: PlayerId[];
    startTimestamp?: number;
    /** Server-authoritative window length; clients animate over this instead
     *  of a hardcoded constant so the bar can't diverge from the server. */
    durationMs?: number;
  } | null;
  checkDetails: {
    callerId: PlayerId | null;
  } | null;
  winnerId: PlayerId | null;
  gameover: {
    winnerIds: PlayerId[];
    loserId: PlayerId | null;
    playerScores: Record<PlayerId, number>;
  } | null;
  lastRoundLoserId: PlayerId | null;
  /** Cumulative round wins per player for this lobby's lifetime. Survives
   *  Play Again (unlike scores); only players still at the table appear. */
  playerWins: Record<PlayerId, number>;
  /** Players (at GAMEOVER) who signalled they want to play again — a live
   *  rematch tally shown to everyone. The host still starts the next round
   *  via PLAY_AGAIN; this is advisory. Reset on each new round. */
  rematchVotes: PlayerId[];
  /** Bumped on each Play Again. A client seeing a new epoch drops its
   *  accumulated log/chat instead of merging, so the panels start fresh. */
  roundEpoch: number;
  log: RichGameLogMessage[];
  chat: ChatMessage[];
  discardPileIsSealed: boolean;
  /** True when the top discard card is a matched (permanently locked) card and
   *  can never be drawn from the pile, even after the seal lifts. */
  discardTopIsLocked: boolean;
  publicPeek: PublicPeekInfo | null;
  publicSwap: PublicSwapInfo | null;
  publicPenalty: PublicPenaltyInfo | null;
  /** When the current timed decision window (draw/discard/ability) expires. */
  turnDeadline: number | null;
  /** Length of a full turn-timer window, for rendering countdowns. */
  turnTimerMs: number;
  /** Seat capacity of this table (lobby renders empty seats up to this). */
  maxPlayers: number;
  /**
   * Server wall-clock at redaction time. All absolute timestamps in this
   * state (turnDeadline, matchingOpportunity.startTimestamp,
   * publicSwap.occurredAt, publicPeek.startedAt) are on the server's clock;
   * clients derive an offset from this field instead of trusting Date.now().
   */
  serverNow: number;
}

// ================================================================================================
//                                    SOCKETS & COMMS
// ================================================================================================

export interface ServerToClientEvents {
  [SocketEventName.GAME_STATE_UPDATE]: (
    gameState: ClientCheckGameState,
  ) => void;
  [SocketEventName.SERVER_LOG_ENTRY]: (logMessage: RichGameLogMessage) => void;
  [SocketEventName.INITIAL_PEEK_INFO]: (data: { hand: Card[] }) => void;
  [SocketEventName.ABILITY_PEEK_RESULT]: (payload: {
    /** Every card of one confirmed peek, in one message, so all its flips
     *  start in the same client commit (per-card messages opened out of
     *  sync under network jitter). */
    results: Array<{
      card: Card;
      playerId: PlayerId;
      cardIndex: number;
    }>;
  }) => void;
  [SocketEventName.INITIAL_LOGS]: (logs: RichGameLogMessage[]) => void;
  [SocketEventName.ERROR_MESSAGE]: (error: { message: string }) => void;
  [SocketEventName.NEW_CHAT_MESSAGE]: (chatMessage: ChatMessage) => void;
}

export interface ClientToServerEvents {
  [SocketEventName.CREATE_GAME]: (
    payload: CreateGamePayload,
    callback: (response: CreateGameResponse) => void,
  ) => void;
  [SocketEventName.JOIN_GAME]: (
    gameId: string,
    playerSetupData: InitialPlayerSetupData,
    callback: (response: JoinGameResponse) => void,
  ) => void;
  [SocketEventName.ATTEMPT_REJOIN]: (
    payload: { gameId: string; playerId: string },
    callback: (response: AttemptRejoinResponse) => void,
  ) => void;
  [SocketEventName.PLAYER_ACTION]: (payload: {
    type: PlayerActionType;
    payload?: any;
  }) => void;
  [SocketEventName.SEND_CHAT_MESSAGE]: (payload: {
    message: string;
    senderId: string;
    senderName: string;
    gameId: string;
  }) => void;
}

export type ServerToClientEventName = keyof ServerToClientEvents;

export enum SocketEventName {
  CREATE_GAME = "CREATE_GAME",
  JOIN_GAME = "JOIN_GAME",
  PLAYER_ACTION = "PLAYER_ACTION",
  GAME_STATE_UPDATE = "GAME_STATE_UPDATE",
  ERROR_MESSAGE = "ERROR_MESSAGE",
  ATTEMPT_REJOIN = "ATTEMPT_REJOIN",
  SEND_CHAT_MESSAGE = "SEND_CHAT_MESSAGE",
  INITIAL_PEEK_INFO = "INITIAL_PEEK_INFO",
  ABILITY_PEEK_RESULT = "ABILITY_PEEK_RESULT",
  SERVER_LOG_ENTRY = "SERVER_LOG_ENTRY",
  INITIAL_LOGS = "INITIAL_LOGS",
  NEW_CHAT_MESSAGE = "NEW_CHAT_MESSAGE",
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

/** CREATE_GAME payload: the host's setup data plus the table size they
 *  picked (2-6). Optional so older clients keep working; the server clamps. */
export interface CreateGamePayload extends InitialPlayerSetupData {
  maxPlayers?: number;
}

export interface ChatMessage {
  id: string;
  senderId: PlayerId;
  senderName: string;
  message: string;
  timestamp: string;
}

// ================================================================================================
//                                    LOGGING & ACTIONS
// ================================================================================================

export interface RichGameLogMessage {
  id: string;
  timestamp: string;
  message: string;
  type: "public" | "private";
  tags: (
    | "game-event"
    | "player-action"
    | "system-message"
    | "error"
    | "ability"
    | "penalty"
  )[];
  payload?: Record<string, unknown>;
  actor?: {
    id: PlayerId;
    name: string;
  };
}

export enum PlayerActionType {
  // Lobby
  START_GAME = "START_GAME",
  DECLARE_LOBBY_READY = "DECLARE_LOBBY_READY",
  DECLARE_LOBBY_UNREADY = "DECLARE_LOBBY_UNREADY",
  LEAVE_GAME = "LEAVE_GAME",
  REMOVE_PLAYER = "REMOVE_PLAYER",

  // Turn Actions
  DRAW_FROM_DECK = "DRAW_FROM_DECK",
  DRAW_FROM_DISCARD = "DRAW_FROM_DISCARD",
  SWAP_AND_DISCARD = "SWAP_AND_DISCARD",
  DISCARD_DRAWN_CARD = "DISCARD_DRAWN_CARD",

  // Matching
  ATTEMPT_MATCH = "ATTEMPT_MATCH",
  PASS_ON_MATCH_ATTEMPT = "PASS_ON_MATCH_ATTEMPT",

  // Game Actions
  CALL_CHECK = "CALL_CHECK",
  DECLARE_READY_FOR_PEEK = "DECLARE_READY_FOR_PEEK",
  PLAY_AGAIN = "PLAY_AGAIN",
  /** Non-host "I want a rematch" toggle. Advisory only — it adds/removes the
   *  player from rematchVotes so everyone sees demand; the host's PLAY_AGAIN
   *  is what actually starts the next round. */
  REQUEST_PLAY_AGAIN = "REQUEST_PLAY_AGAIN",

  // Ability Resolution
  USE_ABILITY = "USE_ABILITY",

  // Misc
  SEND_CHAT_MESSAGE = "SEND_CHAT_MESSAGE",
}

// ================================================================================================
//                                    ABILITIES
// ================================================================================================

export type AbilityType = "peek" | "swap" | "king";

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
  stage: "peeking" | "swapping" | "done";
  playerId: PlayerId;
  sourceCard: Card;
  /** Peeks still owed on this (possibly pooled) ability. When the SAME player
   *  matches two peek-capable cards (e.g. 2× King), the abilities pool: peeks
   *  sum (2+2 = 4) and are taken all at once before any swap. */
  remainingPeeks?: number;
  /** Swaps still owed. Undefined = a single swap. Pooled combos set it >1
   *  (e.g. 2× King = 2 swaps taken after the peeks). */
  remainingSwaps?: number;
}

export type PeekAbilityPayload = {
  action: "peek";
  targets: {
    playerId: PlayerId;
    cardIndex: number;
  }[];
};

export type SwapAbilityPayload = {
  action: "swap";
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
  action: "skip";
};

export type AbilityActionPayload =
  | PeekAbilityPayload
  | SwapAbilityPayload
  | SkipAbilityPayload;

// ================================================================================================
//                                    CLIENT-SPECIFIC STATE
// ================================================================================================
export interface ClientAbilityContext {
  type: AbilityType;
  stage: "peeking" | "swapping" | "done";
  sourceCard: Card;
  maxPeekTargets: number;
  selectedPeekTargets: PeekTarget[];
  peekedCards?: (PeekTarget & { card: Card })[];
  maxSwapTargets: number;
  selectedSwapTargets: SwapTarget[];
  validPeekTargets?: PeekTarget[];
  validSwapTargets?: SwapTarget[];
  playerId: PlayerId;
  /** Swaps still owed on a pooled combo. The client keys a context rebuild on
   *  this so the swap-selection UI re-enters for each swap of a 2× combo. */
  remainingSwaps?: number;
}
