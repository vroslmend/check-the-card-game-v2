import {
  Card,
  CardRank,
  PlayerId,
  GameStage,
  TurnPhase,
  PlayerStatus,
  AbilityType,
  ActiveAbility,
  RichGameLogMessage,
  ChatMessage,
  PublicPeekInfo,
  PublicSwapInfo,
} from "shared-types";

export interface ServerActiveAbility extends Omit<ActiveAbility, "stage"> {
  stage: "peeking" | "swapping";
  source: "discard" | "stack" | "stackSecondOfPair";
  remainingPeeks?: number;
}

export interface ServerPlayer {
  id: PlayerId;
  name: string;
  socketId: string;
  hand: Card[];
  isReady: boolean;
  isDealer: boolean;
  hasCalledCheck: boolean;
  isLocked: boolean;
  score: number;
  isConnected: boolean;
  status: PlayerStatus;
  pendingDrawnCard: { card: Card; source: "deck" | "discard" } | null;
  forfeited: boolean;
}

export interface GameContext {
  gameId: string;
  deck: Card[];
  players: Record<PlayerId, ServerPlayer>;
  discardPile: Card[];
  turnOrder: PlayerId[];
  gameMasterId: PlayerId | null;
  currentPlayerId: PlayerId | null;
  currentTurnSegment: TurnPhase | null;
  gameStage: GameStage;
  matchingOpportunity: {
    cardToMatch: Card;
    originalPlayerID: PlayerId;
    remainingPlayerIDs: PlayerId[];
    startTimestamp: number;
  } | null;
  abilityStack: ServerActiveAbility[];
  checkDetails: {
    callerId: PlayerId;
    finalTurnOrder: PlayerId[];
    finalTurnIndex: number;
  } | null;
  gameover: {
    winnerIds: PlayerId[];
    loserId: PlayerId | null;
    playerScores: Record<PlayerId, number>;
  } | null;
  lastRoundLoserId: PlayerId | null;
  log: RichGameLogMessage[];
  chat: ChatMessage[];
  discardPileIsSealed: boolean;
  /** Ids of cards locked for the round by a successful match. A locked card can
   *  never be drawn from the discard pile. Reset each deal / new round. */
  lockedCardIds: string[];
  errorState: {
    message: string;
    errorType: "DECK_EMPTY" | "NETWORK_ERROR";
    affectedPlayerId?: PlayerId;
  } | null;
  maxPlayers: number;
  cardsPerPlayer: number;
  winnerId: PlayerId | null;
  publicPeek: PublicPeekInfo | null;
  publicSwap: PublicSwapInfo | null;
  turnDeadline: number | null;
  turnTimerMs: number;
}

export type GameInput = {
  gameId: string;
  maxPlayers?: number;
  cardsPerPlayer?: number;
};
