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

// -----------------------------------------------------------------------------
// Server-only type definitions. These were previously declared in
// `game-machine.ts` but do not belong in the shared-types package because they
// describe server-side state and implementation details.
// -----------------------------------------------------------------------------

export interface ServerActiveAbility extends Omit<ActiveAbility, "stage"> {
  /**
   * The current execution phase of the ability. Kings & Peeks have a _peeking_
   * stage first, followed by a _swapping_ stage. Jacks only have _swapping_.
   */
  stage: "peeking" | "swapping";
  /**
   * Where the ability-triggering card originated, used for replay/debugging.
   */
  source: "discard" | "stack" | "stackSecondOfPair";
  /**
   * Remaining peeks for King/Peek abilities. Undefined for Swap (Jack).
   */
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
