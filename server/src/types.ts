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
  errorState: {
    message: string;
    retryCount: number;
    errorType:
      | "DECK_EMPTY"
      | "NETWORK_ERROR"
      | "PLAYER_ERROR"
      | "GENERAL_ERROR"
      | null;
    affectedPlayerId?: PlayerId;
    recoveryState?: unknown;
  } | null;
  maxPlayers: number;
  cardsPerPlayer: number;
  winnerId: PlayerId | null;
}

export type GameInput = {
  gameId: string;
  maxPlayers?: number;
  cardsPerPlayer?: number;
};
