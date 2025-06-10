import { setup, assign, raise, enqueueActions, fromPromise, assertEvent } from 'xstate';
import {
  Card,
  CardRank,
  PlayerActionType,
  InitialPlayerSetupData,
  RichGameLogMessage,
  GameStage,
  TurnPhase,
  PlayerId,
  AbilityActionPayload,
  ActiveAbility,
  AbilityType,
  ChatMessage,
  SocketEventName,
  PlayerStatus,
  PeekTarget,
} from 'shared-types';
import { createDeck, shuffleDeck } from './lib/deck-utils.js';
import 'xstate/guards';

// #region Constants & Server-Side Types
const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '5000', 10);
const TURN_DURATION_MS = parseInt(process.env.TURN_DURATION_MS || '60000', 10);
const MAX_PLAYERS = 4;
const CARDS_PER_PLAYER = 4;

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
  discardPileIsSealed: boolean;
}

type GameInput = {
  gameId: string;
};

// This creates a discriminated union of all possible player actions.
type PlayerActionEvents =
  | { type: PlayerActionType.DRAW_FROM_DECK; playerId: PlayerId; }
  | { type: PlayerActionType.DRAW_FROM_DISCARD; playerId: PlayerId; }
  | { type: PlayerActionType.SWAP_AND_DISCARD; playerId: PlayerId; payload: { cardIndex: number } }
  | { type: PlayerActionType.DISCARD_DRAWN_CARD; playerId: PlayerId; }
  | { type: PlayerActionType.ATTEMPT_MATCH; playerId: PlayerId; payload: { cardIndex: number } }
  | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT; playerId: PlayerId; }
  | { type: PlayerActionType.CALL_CHECK; playerId: PlayerId; }
  | { type: PlayerActionType.DECLARE_READY_FOR_PEEK; playerId: PlayerId; }
  | { type: PlayerActionType.PLAY_AGAIN; playerId: PlayerId; }
  | { type: PlayerActionType.USE_ABILITY; playerId: PlayerId; payload: AbilityActionPayload };

type GameEvent =
  | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData }
  | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | { type: 'START_GAME' }
  | PlayerActionEvents
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
const abilityRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);
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
      gameMasterId: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        if (context.gameMasterId === null) {
          return event.playerSetupData.id!;
        }
        return context.gameMasterId;
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
    dealCards: assign(({ context }) => {
      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      const newDeck = [...context.deck];

      for (let i = 0; i < CARDS_PER_PLAYER; i++) {
        for (const playerId of context.turnOrder) {
          const card = newDeck.pop();
          if (card) {
            newPlayers[playerId]!.hand.push(card);
          }
        }
      }

      const newDiscardPile = [...context.discardPile];
      let topCard = newDeck.pop();

      // Per game rules, the discard pile cannot start with a special card.
      // If a special card is drawn, it is inserted into the middle of the deck.
      while (topCard && specialRanks.has(topCard.rank)) {
        newDeck.splice(Math.floor(newDeck.length / 2), 0, topCard);
        topCard = newDeck.pop();
      }

      if (topCard) {
        newDiscardPile.push(topCard);
      }

      return {
        players: newPlayers,
        deck: newDeck,
        discardPile: newDiscardPile,
      };
    }),
    initializePlayState: assign({
      currentPlayerId: ({ context }) => context.turnOrder[0]!,
      currentTurnSegment: TurnPhase.DRAW,
    }),
    resetPlayersReadyStatus: assign({
      players: ({ context }) => {
        const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
        for (const p of Object.values(newPlayers)) {
          p.isReady = false;
        }
        return newPlayers;
      },
    }),
    setPlayerReady: assign({
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.DECLARE_READY_FOR_PEEK);
        const { playerId } = event;
        const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
        if (newPlayers[playerId]) {
          newPlayers[playerId]!.isReady = true;
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
    discardDrawnCard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const { playerId } = event;
      const player = context.players[playerId];
      if (!player?.pendingDrawnCard) return {};

      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      newPlayers[playerId]!.pendingDrawnCard = null;

      const newDiscardPile = [...context.discardPile, player.pendingDrawnCard.card];

      return {
        players: newPlayers,
        discardPile: newDiscardPile,
      };
    }),
    swapAndDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
      const { playerId, payload } = event;
      
      const player = context.players[playerId];
      if (!player?.pendingDrawnCard) return {};

      const handCard = player.hand[payload.cardIndex];
      if (!handCard) return {};

      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      newPlayers[playerId]!.hand[payload.cardIndex] = player.pendingDrawnCard.card;
      newPlayers[playerId]!.pendingDrawnCard = null;

      const newDiscardPile = [...context.discardPile, handCard];

      return {
        players: newPlayers,
        discardPile: newDiscardPile,
      };
    }),
    prepareAbility: assign({
      activeAbility: ({ context }) => {
        const discardedCard = context.discardPile[context.discardPile.length - 1];
        if (!discardedCard) return null;

        if (discardedCard.rank === CardRank.Queen) {
          return {
            type: 'peek' as const,
            stage: 'peeking' as const,
            playerId: context.currentPlayerId!,
          };
        }

        if (discardedCard.rank === CardRank.Jack) {
          return {
            type: 'swap' as const,
            stage: 'swapping' as const,
            playerId: context.currentPlayerId!,
          };
        }

        if (discardedCard.rank === CardRank.King) {
          return {
            type: 'king' as const,
            stage: 'peeking' as const,
            playerId: context.currentPlayerId!,
          };
        }

        return null;
      },
      currentTurnSegment: TurnPhase.ACTION,
    }),
    advanceTurn: assign({
      currentPlayerId: ({ context }) => {
        if (!context.currentPlayerId) return context.currentPlayerId;
        const currentIndex = context.turnOrder.indexOf(context.currentPlayerId);
        const nextIndex = (currentIndex + 1) % context.turnOrder.length;
        return context.turnOrder[nextIndex]!;
      },
      currentTurnSegment: TurnPhase.DRAW,
    }),
    callCheck: assign({
      checkDetails: ({ event }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        return { callerId: event.playerId };
      },
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
        newPlayers[event.playerId]!.hasCalledCheck = true;
        newPlayers[event.playerId]!.isLocked = true;
        return newPlayers;
      },
      currentPlayerId: ({ context, event }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        const currentIndex = context.turnOrder.indexOf(event.playerId);
        const nextIndex = (currentIndex + 1) % context.turnOrder.length;
        return context.turnOrder[nextIndex]!;
      },
      currentTurnSegment: TurnPhase.DRAW,
    }),
    handleAbilityAction: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      const { activeAbility, players } = context;

      if (!activeAbility || activeAbility.playerId !== playerId) return;

      if (payload.action === 'skip') {
        if (activeAbility.stage === 'peeking') {
          enqueue.assign({ activeAbility: { ...activeAbility, stage: 'swapping' }});
        } else if (activeAbility.stage === 'swapping') {
          enqueue.assign({ activeAbility: { ...activeAbility, stage: 'done' }});
        }
        return;
      }

      if (payload.action === 'peek' && activeAbility.stage === 'peeking') {
        const peekedCards = payload.targets.map((target: PeekTarget) => {
          const targetPlayer = players[target.playerId];
          const card = targetPlayer?.hand[target.cardIndex];
          return { ...target, card };
        }).filter((item): item is PeekTarget & { card: Card } => !!item.card);

        if (peekedCards.length > 0) {
          enqueue.emit({
            type: 'SEND_EVENT_TO_PLAYER',
            payload: {
              playerId,
              eventName: SocketEventName.ABILITY_PEEK_RESULT,
              eventData: { cards: peekedCards }
            }
          });
        }
        // After peeking, Queen and King abilities move to the swap stage.
        enqueue.assign({ activeAbility: { ...activeAbility, stage: 'swapping' } });
        return;
      }

      if (payload.action === 'swap' && activeAbility.stage === 'swapping') {
        const { source, target } = payload;
        const player1 = players[source.playerId];
        const player2 = players[target.playerId];
        const card1 = player1?.hand[source.cardIndex];
        const card2 = player2?.hand[target.cardIndex];

        if (player1 && player2 && card1 && card2) {
          const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(players));
          newPlayers[source.playerId]!.hand[source.cardIndex] = card2;
          newPlayers[target.playerId]!.hand[target.cardIndex] = card1;
          enqueue.assign({ players: newPlayers });
        }
        // After swapping, the ability is done.
        enqueue.assign({ activeAbility: { ...activeAbility, stage: 'done' } });
      }
    }),
    sendPeekInfoToPlayers: enqueueActions(({ context, enqueue }) => {
      // According to rules, players peek at their bottom two cards (indices 2 and 3)
      const peekableIndices = [2, 3];
      for (const player of Object.values(context.players)) {
        const peekableCards = peekableIndices.map(index => ({
          index,
          card: player.hand[index],
        }));
        enqueue.emit({
          type: 'SEND_EVENT_TO_PLAYER',
          payload: {
            playerId: player.id,
            eventName: SocketEventName.INITIAL_PEEK_INFO,
            eventData: { cards: peekableCards },
          }
        });
      }
    }),
    prepareNewRound: assign({
      deck: shuffleDeck(createDeck()),
      discardPile: [],
      players: ({ context }) => {
        const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
        for (const p of Object.values(newPlayers)) {
          p.hand = [];
          p.hasCalledCheck = false;
          p.isLocked = false;
          p.isReady = false;
          p.pendingDrawnCard = null;
        }
        return newPlayers;
      },
      turnOrder: ({ context }) => {
        if (!context.lastRoundLoserId) return context.turnOrder;

        const newTurnOrder = [...context.turnOrder];
        const loserIndex = newTurnOrder.indexOf(context.lastRoundLoserId);

        if (loserIndex > -1) {
          const [loserId] = newTurnOrder.splice(loserIndex, 1);
          newTurnOrder.unshift(loserId);
        }
        return newTurnOrder;
      },
      gameover: null,
      lastRoundLoserId: null,
      checkDetails: null,
      activeAbility: null,
      currentPlayerId: null,
      currentTurnSegment: null,
    }),
    tallyRoundScores: assign(({ context }) => {
      const playerHandValues: Record<PlayerId, number> = {};
      for (const p of Object.values(context.players)) {
        playerHandValues[p.id] = p.hand.reduce((sum, card) => sum + cardScoreValues[card.rank], 0);
      }

      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      let roundWinnerId: PlayerId | null = null;
      let roundLoserId: PlayerId | null = null;
      let lowestScore = Infinity;
      let highestScore = -Infinity;

      for (const playerId in newPlayers) {
        const handValue = playerHandValues[playerId]!;
        newPlayers[playerId]!.score += handValue; // Update total score

        if (handValue < lowestScore) {
          lowestScore = handValue;
          roundWinnerId = playerId;
        }
        if (handValue > highestScore) {
          highestScore = handValue;
          roundLoserId = playerId;
        }
      }

      const finalPlayerScores = Object.fromEntries(Object.values(newPlayers).map((p) => [p.id, p.score]));

      return {
        players: newPlayers,
        gameover: {
          winnerId: roundWinnerId,
          playerScores: finalPlayerScores,
        },
        lastRoundLoserId: roundLoserId,
      };
    }),
    reconnectPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_RECONNECTED');
        const { playerId, newSocketId } = event;
        const newPlayers = { ...context.players };
        if (newPlayers[playerId]) {
          newPlayers[playerId]!.socketId = newSocketId;
          newPlayers[playerId]!.isConnected = true;
        }
        return newPlayers;
      },
    }),
    disconnectPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_DISCONNECTED');
        const { playerId } = event;
        const newPlayers = { ...context.players };
        if (newPlayers[playerId]) {
          newPlayers[playerId]!.isConnected = false;
        }
        return newPlayers;
      },
    }),
    setupMatchingOpportunity: assign({
      matchingOpportunity: ({ context }) => {
        const cardToMatch = context.discardPile[context.discardPile.length - 1];
        if (!cardToMatch) return null;
        return {
          cardToMatch: cardToMatch,
          originalPlayerID: context.currentPlayerId!,
        };
      },
      discardPileIsSealed: false,
    }),
    handleSuccessfulMatch: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload } = event;
      
      const player = context.players[playerId];
      const matchingCard = player?.hand[payload.cardIndex];
      if (!player || !matchingCard) return;

      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      const playerHand = newPlayers[playerId]!.hand;
      
      playerHand.splice(payload.cardIndex, 1);

      const newDiscardPile = [...context.discardPile, matchingCard];

      enqueue.assign({
        players: newPlayers,
        discardPile: newDiscardPile,
        discardPileIsSealed: true,
        matchingOpportunity: null,
      });

      // Automatic "Check" if hand is empty and check hasn't been called
      if (playerHand.length === 0 && !context.checkDetails) {
        enqueue.assign({
          checkDetails: { callerId: playerId },
          players: ({ context: currentContext }) => {
            const playersAfterCheck = JSON.parse(JSON.stringify(currentContext.players));
            playersAfterCheck[playerId]!.hasCalledCheck = true;
            playersAfterCheck[playerId]!.isLocked = true;
            return playersAfterCheck;
          }
        });
      }
    }),
    clearMatchingOpportunity: assign({
      matchingOpportunity: null,
    }),
  },
  guards: {
    isValidAbilityAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      const { activeAbility } = context;

      if (!activeAbility || activeAbility.playerId !== playerId) return false;

      const { type, stage } = activeAbility;

      if (payload.action === 'skip') return true;

      if (payload.action === 'peek' && stage === 'peeking') {
        if (type === 'peek' && payload.targets.length === 1) return true; // Queen
        if (type === 'king' && payload.targets.length <= 2) return true; // King
      }

      if (payload.action === 'swap' && stage === 'swapping') {
        if (type === 'swap' || type === 'peek' || type === 'king') return true;
      }

      return false;
    },
    canDrawFromDiscard: ({ context }) => {
        if (context.discardPileIsSealed) return false;
        const topOfDiscard = context.discardPile[context.discardPile.length - 1];
        if (!topOfDiscard) return false;
        return !specialRanks.has(topOfDiscard.rank);
    },
    canJoinGame: ({ context }) => {
      return (
        Object.keys(context.players).length < MAX_PLAYERS
      );
    },
    isAbilityCardDiscarded: ({ context }) => {
      const topCard = context.discardPile[context.discardPile.length - 1];
      if (!topCard) return false;
      return abilityRanks.has(topCard.rank);
    },
    areAllPlayersReady: ({ context }) => {
      return context.turnOrder.every((id) => context.players[id]?.isReady);
    },
    canAttemptMatch: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload } = event;
      const { matchingOpportunity } = context;

      if (!matchingOpportunity) {
        return false;
      }

      const player = context.players[playerId];
      const card = player?.hand[payload.cardIndex];

      return !!card && card.rank === matchingOpportunity.cardToMatch.rank;
    },
  },
  actors: {
    peekTimerActor: fromPromise(async () => {
        await new Promise(resolve => setTimeout(resolve, PEEK_TOTAL_DURATION_MS));
        return {};
    }),
    matchingTimerActor: fromPromise(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return {};
    }),
  }
}).createMachine({
  id: 'game',
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
      discardPileIsSealed: false,
    }),
    initial: GameStage.WAITING_FOR_PLAYERS,
    on: {
      PLAYER_RECONNECTED: {
        actions: 'reconnectPlayer',
      },
      PLAYER_DISCONNECTED: {
        actions: 'disconnectPlayer',
      },
    },
      states: {
      [GameStage.WAITING_FOR_PLAYERS]: {
        on: {
          PLAYER_JOIN_REQUEST: {
            guard: 'canJoinGame',
            actions: 'createPlayer',
          },
          START_GAME: {
            target: GameStage.DEALING,
            actions: 'setAllPlayersToPlaying',
          },
        },
      },
      [GameStage.DEALING]: {
        entry: assign({
          log: ({ context }) => [
            ...context.log,
            createLogEntry(context, {
              message: 'The game has started. Dealing cards...',
              type: 'public',
              tags: ['system-message'],
            }),
          ],
        }),
        always: {
          target: GameStage.INITIAL_PEEK,
          actions: ['dealCards', 'resetPlayersReadyStatus'],
        },
      },
      [GameStage.INITIAL_PEEK]: {
        entry: [
          'sendPeekInfoToPlayers',
          assign({
            log: ({ context }) => [
              ...context.log,
              createLogEntry(context, {
                message: `Players have ${PEEK_TOTAL_DURATION_MS / 1000} seconds to peek at their cards.`,
                type: 'public',
                tags: ['game-event'],
              }),
            ],
          }),
        ],
        invoke: {
          src: 'peekTimerActor',
          onDone: {
            target: GameStage.PLAYING,
            actions: [
              assign({
                log: ({ context }) => [
                  ...context.log,
                  createLogEntry(context, {
                    message: 'Peek time expired. Starting game.',
                    type: 'public',
                    tags: ['system-message'],
                  }),
                ],
              }),
              'initializePlayState'
            ],
          },
        },
        on: {
          [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
            actions: 'setPlayerReady',
          },
        },
        always: {
          guard: 'areAllPlayersReady',
          target: GameStage.PLAYING,
          actions: 'initializePlayState',
        },
      },
      [GameStage.PLAYING]: {
        initial: TurnPhase.DRAW,
        on: {
          endTurn: {
            target: `.${TurnPhase.DRAW}`,
            actions: 'advanceTurn',
          },
        },
      states: {
            [TurnPhase.DRAW]: {
                on: {
                    [PlayerActionType.DRAW_FROM_DECK]: { actions: 'drawFromDeck' },
                    [PlayerActionType.DRAW_FROM_DISCARD]: { guard: 'canDrawFromDiscard', actions: 'drawFromDiscard' },
                    [PlayerActionType.CALL_CHECK]: { target: `#game.${GameStage.CHECK}`, actions: 'callCheck' },
                }
            },
            [TurnPhase.DISCARD]: {
              on: {
                [PlayerActionType.DISCARD_DRAWN_CARD]: {
                  actions: 'discardDrawnCard',
                },
                [PlayerActionType.SWAP_AND_DISCARD]: {
                  actions: 'swapAndDiscard',
                },
              },
              always: {
                target: TurnPhase.MATCHING,
                actions: 'setupMatchingOpportunity',
              },
            },
            [TurnPhase.MATCHING]: {
              always: {
                // If a match was just made, the opportunity is gone. We then check for abilities or end the turn.
                guard: ({ context }) => context.matchingOpportunity === null,
                target: TurnPhase.DISCARD, // Re-evaluates on an empty transition
                reenter: true,
              },
              invoke: {
                src: 'matchingTimerActor',
                onDone: [
                  {
                    guard: 'isAbilityCardDiscarded',
                    target: TurnPhase.ACTION,
                    actions: ['clearMatchingOpportunity', 'prepareAbility'],
                  },
                  {
                    actions: ['clearMatchingOpportunity', raise({ type: 'endTurn' })],
                  },
                ],
              },
              on: {
                [PlayerActionType.ATTEMPT_MATCH]: {
                  guard: 'canAttemptMatch',
                  actions: 'handleSuccessfulMatch',
                  target: TurnPhase.MATCHING,
                  reenter: true,
                },
              },
            },
            [TurnPhase.ACTION]: {
              on: {
                [PlayerActionType.USE_ABILITY]: {
                  guard: 'isValidAbilityAction',
                  actions: 'handleAbilityAction',
                },
              },
              always: {
                guard: ({ context }) => context.activeAbility?.stage === 'done',
                actions: raise({ type: 'endTurn' }),
              },
            }
        }
      },
      [GameStage.CHECK]: {
        always: [
          {
            guard: ({ context }) => context.checkDetails !== null && context.players[context.checkDetails.callerId]!.hand.length === 0,
            target: GameStage.GAMEOVER,
            actions: 'tallyRoundScores',
          },
          {
            guard: ({ context }) => context.currentPlayerId === context.checkDetails?.callerId,
            target: GameStage.GAMEOVER,
            actions: 'tallyRoundScores',
          }
        ],
        initial: TurnPhase.DRAW,
        on: {
          endTurn: {
            target: `.${TurnPhase.DRAW}`,
            actions: 'advanceTurn',
          },
        },
        states: {
          [TurnPhase.DRAW]: {
            on: {
              [PlayerActionType.DRAW_FROM_DECK]: { actions: 'drawFromDeck' },
              [PlayerActionType.DRAW_FROM_DISCARD]: { guard: 'canDrawFromDiscard', actions: 'drawFromDiscard' },
            },
          },
          [TurnPhase.DISCARD]: {
            on: {
              [PlayerActionType.DISCARD_DRAWN_CARD]: {
                actions: 'discardDrawnCard',
              },
              [PlayerActionType.SWAP_AND_DISCARD]: {
                actions: 'swapAndDiscard',
              },
            },
            always: {
              target: TurnPhase.MATCHING,
              actions: 'setupMatchingOpportunity',
            },
          },
          [TurnPhase.ACTION]: {
            on: {
              [PlayerActionType.USE_ABILITY]: {
                guard: 'isValidAbilityAction',
                actions: 'handleAbilityAction',
              },
             },
             always: {
                guard: ({ context }) => context.activeAbility?.stage === 'done',
                actions: raise({ type: 'endTurn' }),
             },
          },
        },
      },
      [GameStage.GAMEOVER]: {
        on: {
          [PlayerActionType.PLAY_AGAIN]: {
            target: GameStage.DEALING,
            actions: 'prepareNewRound',
          },
        },
      },
    }
});
