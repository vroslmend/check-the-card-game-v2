import { setup, assign, raise, enqueueActions, fromPromise, emit, and, assertEvent } from 'xstate';
import {
  Card,
  CardRank,
  PlayerActionType,
  InitialPlayerSetupData,
  RichGameLogMessage,
  GameStage,
  TurnPhase,
  PlayerId,
  AbilityPayload,
  ActiveAbility,
  AbilityType,
  PeekAbilityPayload,
  SwapAbilityPayload,
  ChatMessage,
  SocketEventName,
  PlayerStatus,
} from 'shared-types';
import { createDeck, shuffleDeck } from './lib/deck-utils.js';
import 'xstate/guards';

// #region Constants & Server-Side Types
const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '5000', 10);
const TURN_DURATION_MS = parseInt(process.env.TURN_DURATION_MS || '60000', 10);

interface ServerPlayer {
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
  pendingDrawnCard: {
    card: Card;
    source: 'deck' | 'discard';
  } | null;
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
  matchingOpportunity: {
    cardToMatch: Card;
    originalPlayerID: PlayerId;
  } | null;
  activeAbility: ActiveAbility | null;
  checkDetails: {
    callerId: PlayerId;
  } | null;
  gameover: {
    winnerId: PlayerId | null;
    playerScores: Record<PlayerId, number>;
  } | null;
  lastRoundLoserId: PlayerId | null;
  log: RichGameLogMessage[];
  chat: ChatMessage[];
}

type GameInput = {
  gameId: string;
};

// This creates a discriminated union of all possible player actions.
type PlayerActionEvents = {
  [K in PlayerActionType]: { type: K; playerId: PlayerId; payload?: any };
};


type GameEvent =
  | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData }
  | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | { type: 'START_GAME' }
  | PlayerActionEvents[PlayerActionType]
  | { type: 'TIMER.PEEK_EXPIRED' }
  | { type: 'endTurn' };

type EmittedEvent =
  | { type: 'BROADCAST_GAME_STATE'; gameId: string }
  | { type: 'EMIT_LOG_PUBLIC'; gameId: string; publicLogData: RichGameLogMessage }
  | {
      type: 'SEND_EVENT_TO_PLAYER';
      payload: {
        playerId: PlayerId;
        eventName: SocketEventName;
        eventData: unknown;
      };
    };

const getPlayerNameForLog = (playerId: string, context: GameContext): string => {
    return context.players[playerId]?.name || 'P-' + playerId.slice(-4);
};

const createLogEntry = (
  context: GameContext,
  data: Omit<RichGameLogMessage, 'id' | 'timestamp'>
): RichGameLogMessage => {
              return {
    id: `log_${context.gameId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...data,
  };
};

const cardScoreValues: Record<CardRank, number> = {
  [CardRank.Ace]: -1, [CardRank.Two]: 2, [CardRank.Three]: 3, [CardRank.Four]: 4, [CardRank.Five]: 5,
  [CardRank.Six]: 6, [CardRank.Seven]: 7, [CardRank.Eight]: 8, [CardRank.Nine]: 9, [CardRank.Ten]: 10,
  [CardRank.Jack]: 11, [CardRank.Queen]: 12, [CardRank.King]: 13,
};

const specialRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);
// #endregion

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    emitted: {} as EmittedEvent,
    input: {} as GameInput,
  },
  actions: {
    createPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
                const { playerSetupData } = event;
        const newPlayers = { ...context.players };
        newPlayers[playerSetupData.id!] = {
          id: playerSetupData.id!,
          name: playerSetupData.name,
          socketId: playerSetupData.socketId!,
          hand: [],
          isReady: false,
          isDealer: Object.keys(newPlayers).length === 0, // First player is the dealer
                hasCalledCheck: false,
                isLocked: false,
                score: 0,
                  isConnected: true,
          status: PlayerStatus.WAITING,
          pendingDrawnCard: null,
                forfeited: false,
        };
        return newPlayers;
      },
      turnOrder: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        return [...context.turnOrder, event.playerSetupData.id!];
      },
    }),
    setAllPlayersToPlaying: assign({
      players: ({ context }) => {
        const newPlayers = { ...context.players };
        for (const playerId in newPlayers) {
          newPlayers[playerId]!.status = PlayerStatus.PLAYING;
        }
        return newPlayers;
      },
    }),
    drawFromDeck: assign(({ context, event }) => {
        assertEvent(event, PlayerActionType.DRAW_FROM_DECK);
        const newDeck = [...context.deck];
        const drawnCard = newDeck.pop();
        if (!drawnCard) return {};
            const newPlayers = { ...context.players };
        newPlayers[event.playerId]!.pendingDrawnCard = { card: drawnCard, source: 'deck' };
        return { deck: newDeck, players: newPlayers, currentTurnSegment: TurnPhase.DISCARD };
    }),
    drawFromDiscard: assign(({ context, event }) => {
        assertEvent(event, PlayerActionType.DRAW_FROM_DISCARD);
        const newDiscard = [...context.discardPile];
        const drawnCard = newDiscard.pop();
        if (!drawnCard) return {};
        const newPlayers = { ...context.players };
        newPlayers[event.playerId]!.pendingDrawnCard = { card: drawnCard, source: 'discard' };
        return { discardPile: newDiscard, players: newPlayers, currentTurnSegment: TurnPhase.DISCARD };
    }),
    callCheck: assign({
        checkDetails: ({ event }) => {
            assertEvent(event, PlayerActionType.CALL_CHECK);
            return { callerId: event.playerId };
        },
        players: ({ context, event }) => {
            assertEvent(event, PlayerActionType.CALL_CHECK);
            const newPlayers = { ...context.players };
            newPlayers[event.playerId]!.hasCalledCheck = true;
            newPlayers[event.playerId]!.isLocked = true;
            return newPlayers;
        }
    }),
    handleUseAbility: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      if (!payload) return;
      const { activeAbility, players } = context;
      if (!activeAbility || activeAbility.playerId !== playerId) return;

      if (payload.type === 'peek') {
        const targetPlayer = players[payload.targetPlayerId];
        const card = targetPlayer?.hand[payload.cardIndex];
        if (card) {
                            enqueue.emit({
            type: 'SEND_EVENT_TO_PLAYER',
            payload: { playerId, eventName: SocketEventName.ABILITY_PEEK_RESULT, eventData: { card, playerId: payload.targetPlayerId, cardIndex: payload.cardIndex } }
          });
        }
      } else if (payload.type === 'swap') {
        const player1 = players[payload.sourcePlayerId];
        const player2 = players[payload.targetPlayerId];
        const card1 = player1?.hand[payload.sourceCardIndex];
        const card2 = player2?.hand[payload.targetCardIndex];

        if (player1 && player2 && card1 && card2) {
          const newPlayers = JSON.parse(JSON.stringify(players));
          newPlayers[player1.id].hand[payload.sourceCardIndex] = card2;
          newPlayers[player2.id].hand[payload.targetCardIndex] = card1;
          enqueue.assign({ players: newPlayers });
        }
      }
      enqueue.assign({ activeAbility: null, currentTurnSegment: null });
      enqueue.raise({ type: 'endTurn' });
    }),
  },
  guards: {
    canUseAbility: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      if (!payload || !context.activeAbility || context.activeAbility.playerId !== playerId || payload.type !== context.activeAbility.type) return false;
      if (payload.type === 'peek') {
        return !!context.players[payload.targetPlayerId]?.hand[payload.cardIndex];
      }
      if (payload.type === 'swap') {
        return !!context.players[payload.sourcePlayerId]?.hand[payload.sourceCardIndex] && !!context.players[payload.targetPlayerId]?.hand[payload.targetCardIndex];
      }
      return false;
    },
    canDrawFromDiscard: ({ context }) => {
        const topOfDiscard = context.discardPile[context.discardPile.length - 1];
        if (!topOfDiscard) return false;
        return !specialRanks.has(topOfDiscard.rank);
    }
  },
  actors: {
    peekTimerActor: fromPromise(async () => {
        await new Promise(resolve => setTimeout(resolve, PEEK_TOTAL_DURATION_MS));
        return {};
    }),
  }
}).createMachine({
  id: 'checkGame',
    context: ({ input }: { input: GameInput }): GameContext => ({
      gameId: input.gameId,
      deck: shuffleDeck(createDeck()),
      players: {},
      discardPile: [],
      turnOrder: [],
      gameMasterId: null,
      currentPlayerId: null,
      currentTurnSegment: null,
      matchingOpportunity: null,
      activeAbility: null,
      checkDetails: null,
      gameover: null,
      lastRoundLoserId: null,
      log: [],
      chat: [],
    }),
    initial: GameStage.WAITING_FOR_PLAYERS,
    on: {
      PLAYER_JOIN_REQUEST: {
        actions: 'createPlayer',
      },
    },
      states: {
      [GameStage.WAITING_FOR_PLAYERS]: {
        on: {
          START_GAME: {
            target: GameStage.DEALING,
            actions: 'setAllPlayersToPlaying',
          },
        },
      },
      [GameStage.DEALING]: {
        // ...
      },
      [GameStage.PLAYING]: {
        initial: TurnPhase.DRAW,
      states: {
            [TurnPhase.DRAW]: {
                on: {
                    [PlayerActionType.DRAW_FROM_DECK]: { actions: 'drawFromDeck' },
                    [PlayerActionType.DRAW_FROM_DISCARD]: { guard: 'canDrawFromDiscard', actions: 'drawFromDiscard' },
                    [PlayerActionType.CALL_CHECK]: { target: `#checkGame.${GameStage.CHECK}`, actions: 'callCheck' },
                }
            },
            [TurnPhase.DISCARD]: {
                // ...
            },
            [TurnPhase.ACTION]: {
                // ...
            }
        }
      },
      [GameStage.CHECK]: {
        // ...
      },
      [GameStage.GAMEOVER]: {
        // ...
      }
    }
});