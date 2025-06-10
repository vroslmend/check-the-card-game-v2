import { setup, assign, fromPromise, assertEvent, emit, and, enqueueActions } from 'xstate';
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
} from 'shared-types';
import { createDeck, shuffleDeck } from './lib/deck-utils.js';
import 'xstate/guards';

// #region Constants & Server-Side Types
const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '5000', 10);
const MAX_PLAYERS = 4;
const CARDS_PER_PLAYER = 4;

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
    remainingPlayerIDs: PlayerId[];
  } | null;
  activeAbility: ActiveAbility | null;
  checkDetails: {
    callerId: PlayerId;
    playersYetToPlay: PlayerId[];
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

type GameInput = {
  gameId: string;
};

type PlayerActionEvents =
  | { type: PlayerActionType.START_GAME; playerId: PlayerId; }
  | { type: PlayerActionType.DECLARE_LOBBY_READY; playerId: PlayerId; }
  | { type: PlayerActionType.DRAW_FROM_DECK; playerId: PlayerId }
  | { type: PlayerActionType.DRAW_FROM_DISCARD; playerId: PlayerId }
  | { type: PlayerActionType.SWAP_AND_DISCARD; playerId: PlayerId; payload: { handCardIndex: number } }
  | { type: PlayerActionType.DISCARD_DRAWN_CARD; playerId: PlayerId }
  | { type: PlayerActionType.ATTEMPT_MATCH; playerId: PlayerId; payload: { handCardIndex: number } }
  | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT; playerId: PlayerId }
  | { type: PlayerActionType.CALL_CHECK; playerId: PlayerId }
  | { type: PlayerActionType.DECLARE_READY_FOR_PEEK; playerId: PlayerId }
  | { type: PlayerActionType.PLAY_AGAIN; playerId: PlayerId }
  | { type: PlayerActionType.USE_ABILITY; playerId: PlayerId; payload: AbilityActionPayload }
  | { type: PlayerActionType.SEND_CHAT_MESSAGE, payload: Omit<ChatMessage, 'id' | 'timestamp'> };


type GameEvent =
  | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData; playerId: PlayerId }
  | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | PlayerActionEvents
  | { type: 'TIMER.PEEK_EXPIRED' }
  | { type: 'TIMER.MATCHING_EXPIRED' };

type EmittedEvent =
  | { type: 'BROADCAST_GAME_STATE' }
  | { type: 'PLAYER_JOIN_SUCCESSFUL'; playerId: PlayerId }
  | { type: 'PLAYER_RECONNECT_SUCCESSFUL'; playerId: PlayerId }
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
  guards: {
    canJoinGame: ({ context }) => Object.keys(context.players).length < MAX_PLAYERS,
    isGameMaster: ({ context, event }) => {
      assertEvent(event, PlayerActionType.START_GAME);
      return event.playerId === context.gameMasterId;
    },
    areAllPlayersReady: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter((p) => p.isConnected);
      if (connectedPlayers.length < 2) return false;
      return connectedPlayers.every((p) => p.isReady);
    },
    allPlayersReadyForPeek: ({ context }) => {
      return context.turnOrder.every((id) => context.players[id]?.isReady);
    },
    isPlayerTurn: ({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.DRAW_FROM_DECK,
        PlayerActionType.DRAW_FROM_DISCARD,
        PlayerActionType.SWAP_AND_DISCARD,
        PlayerActionType.DISCARD_DRAWN_CARD,
        PlayerActionType.CALL_CHECK,
      ]);
      return event.playerId === context.currentPlayerId;
    },
    hasDrawnCard: ({ context, event }) => {
      assertEvent(event, [PlayerActionType.SWAP_AND_DISCARD, PlayerActionType.DISCARD_DRAWN_CARD]);
      return !!context.players[event.playerId]?.pendingDrawnCard;
    },
    wasDrawnFromDeck: ({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const drawnInfo = context.players[event.playerId]?.pendingDrawnCard;
      return drawnInfo?.source === 'deck';
    },
    canDrawFromDiscard: ({ context }) => {
      if (context.discardPileIsSealed) return false;
      const topOfDiscard = context.discardPile[context.discardPile.length - 1];
      if (!topOfDiscard) return false;
      return !specialRanks.has(topOfDiscard.rank);
    },
    matchWillEmptyHand: ({ context, event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        return context.players[event.playerId]!.hand.length === 1;
    },
    isAbilityCardDiscarded: ({ context }) => {
      const topCard = context.discardPile[context.discardPile.length - 1];
      if (!topCard) return false;
      return abilityRanks.has(topCard.rank);
    },
    canAttemptMatch: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload } = event;
      const { matchingOpportunity } = context;
      if (!matchingOpportunity) return false;

      const player = context.players[playerId];
      const cardInHand = player?.hand[payload.handCardIndex];
      return !!cardInHand && cardInHand.rank === matchingOpportunity.cardToMatch.rank;
    },
    isValidAbilityAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId } = event;
      const { activeAbility } = context;
      if (!activeAbility || activeAbility.playerId !== playerId) return false;
      return true;
    },
    isNotLocked: ({ context, event }) => {
      assertEvent(event, PlayerActionType.CALL_CHECK);
      return !context.players[event.playerId]?.isLocked;
    },
  },
  actions: {
    broadcastGameState: emit({ type: 'BROADCAST_GAME_STATE' as const }),
    emitPlayerJoinSuccessful: emit(({ event }) => {
      assertEvent(event, 'PLAYER_JOIN_REQUEST');
      return { type: 'PLAYER_JOIN_SUCCESSFUL' as const, playerId: event.playerId };
    }),
    emitPlayerReconnectSuccessful: emit(({ event }) => {
      assertEvent(event, 'PLAYER_RECONNECTED');
      return { type: 'PLAYER_RECONNECT_SUCCESSFUL' as const, playerId: event.playerId };
    }),
    createPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        const { playerSetupData } = event;
        const newPlayers = { ...context.players };
        newPlayers[playerSetupData.id!] = {
          id: playerSetupData.id!, name: playerSetupData.name, socketId: playerSetupData.socketId!,
          hand: [], isReady: false, isDealer: Object.keys(newPlayers).length === 0,
          hasCalledCheck: false, isLocked: false, score: 0, isConnected: true,
          status: PlayerStatus.WAITING, pendingDrawnCard: null, forfeited: false,
        };
        return newPlayers;
      },
      turnOrder: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        return [...context.turnOrder, event.playerSetupData.id!];
      },
      gameMasterId: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        return context.gameMasterId === null ? event.playerSetupData.id! : context.gameMasterId;
      },
    }),
    setPlayerConnected: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_RECONNECTED');
        const newPlayers = { ...context.players };
        if (newPlayers[event.playerId]) {
          newPlayers[event.playerId]!.isConnected = true;
          newPlayers[event.playerId]!.socketId = event.newSocketId;
        }
        return newPlayers;
      },
    }),
    setPlayerDisconnected: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_DISCONNECTED');
        const newPlayers = { ...context.players };
        if (newPlayers[event.playerId]) newPlayers[event.playerId]!.isConnected = false;
        return newPlayers;
      },
    }),
    setPlayerReady: assign({
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.DECLARE_LOBBY_READY);
        const newPlayers = { ...context.players };
        if (newPlayers[event.playerId]) newPlayers[event.playerId]!.isReady = true;
        return newPlayers;
      },
    }),
    setPlayerReadyForPeek: assign({
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.DECLARE_READY_FOR_PEEK);
        const newPlayers = { ...context.players };
        if (newPlayers[event.playerId]) newPlayers[event.playerId]!.isReady = true;
        return newPlayers;
      },
    }),
    resetPlayersReadyStatus: assign({
      players: ({ context }) => {
        const newPlayers = { ...context.players };
        for (const p of Object.values(newPlayers)) p.isReady = false;
        return newPlayers;
      },
    }),
    setAllPlayersToPlaying: assign({
      players: ({ context }) => {
        const newPlayers = { ...context.players };
        for (const playerId in newPlayers) newPlayers[playerId]!.status = PlayerStatus.PLAYING;
        return newPlayers;
      },
    }),
    addPlayerJoinedLog: assign({
      log: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        const logEntry = createLogEntry(context, {
          message: `${getPlayerNameForLog(event.playerId, context)} joined the game.`,
          type: 'public', tags: ['system-message', 'player-action'],
        });
        return [...context.log, logEntry];
      },
    }),
    addPlayerReconnectedLog: assign({
      log: ({ context, event }) => {
        assertEvent(event, 'PLAYER_RECONNECTED');
        return [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(event.playerId, context)} reconnected.`, type: 'public', tags: ['system-message'] })];
      }
    }),
    addPlayerDisconnectedLog: assign({
        log: ({ context, event }) => {
          assertEvent(event, 'PLAYER_DISCONNECTED');
          return [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(event.playerId, context)} disconnected.`, type: 'public', tags: ['system-message'] })];
        }
    }),
    addChatMessage: assign({
      chat: ({ context, event }) => {
        assertEvent(event, PlayerActionType.SEND_CHAT_MESSAGE);
        const newChatMessage: ChatMessage = {
          id: `chat_${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...event.payload,
        };
        return [...context.chat, newChatMessage];
      }
    }),
    dealCards: assign(({ context }) => {
      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      const newDeck = [...context.deck];

      for (let i = 0; i < CARDS_PER_PLAYER; i++) {
        for (const playerId of context.turnOrder) {
          const card = newDeck.pop();
          if (card) newPlayers[playerId]!.hand.push(card);
        }
      }

      const newDiscardPile = [...context.discardPile];
      let topCard = newDeck.pop();
      while (topCard && specialRanks.has(topCard.rank)) {
        newDeck.splice(Math.floor(newDeck.length / 2), 0, topCard);
        topCard = newDeck.pop();
      }
      if (topCard) newDiscardPile.push(topCard);

      return { players: newPlayers, deck: newDeck, discardPile: newDiscardPile };
    }),
    initializePlayState: assign({
      currentPlayerId: ({ context }) => context.turnOrder[0]!,
      currentTurnSegment: TurnPhase.DRAW,
    }),
    setNextPlayer: assign(({ context }) => {
        const { currentPlayerId, turnOrder } = context;
        const currentIndex = turnOrder.indexOf(currentPlayerId!);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        return { currentPlayerId: turnOrder[nextIndex]! };
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
    swapAndDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
      const { playerId, payload: { handCardIndex } } = event;
      const player = context.players[playerId]!;
      const drawn = player.pendingDrawnCard;
      if (!drawn) return {};

      const newHand = [...player.hand];
      const cardToDiscard = newHand[handCardIndex]!;
      newHand[handCardIndex] = drawn.card;
      
      const newPlayers = { ...context.players };
      newPlayers[playerId]!.hand = newHand;
      newPlayers[playerId]!.pendingDrawnCard = null;

      const newDiscardPile = [...context.discardPile, cardToDiscard];
      
      return { players: newPlayers, discardPile: newDiscardPile };
    }),
    discardDrawnCard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const player = context.players[event.playerId]!;
      const drawn = player.pendingDrawnCard;
      if (!drawn) return {};
      
      const newPlayers = { ...context.players };
      newPlayers[event.playerId]!.pendingDrawnCard = null;
      const newDiscardPile = [...context.discardPile, drawn.card];
      
      return { players: newPlayers, discardPile: newDiscardPile };
    }),
    setupMatchingOpportunity: assign({
      matchingOpportunity: ({ context }) => {
        const cardToMatch = context.discardPile[context.discardPile.length - 1];
        if (!cardToMatch || specialRanks.has(cardToMatch.rank)) return null;
        
        const originalPlayerID = context.currentPlayerId!;
        const otherPlayerIDs = context.turnOrder.filter(id => id !== originalPlayerID);

        return { cardToMatch, originalPlayerID, remainingPlayerIDs: otherPlayerIDs };
      },
    }),
    handleSuccessfulMatch: assign(({ context, event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        const { playerId, payload: { handCardIndex } } = event;
        const matchingPlayer = context.players[playerId]!;

        const cardToPlaceOnPile = matchingPlayer.hand[handCardIndex]!;
        
        const newPlayers = { ...context.players };
        const newMatchingPlayerHand = [...matchingPlayer.hand];
        newMatchingPlayerHand.splice(handCardIndex, 1);
        newPlayers[matchingPlayer.id]!.hand = newMatchingPlayerHand;
        
        const newDiscardPile = [...context.discardPile, cardToPlaceOnPile];

        const handIsEmpty = newMatchingPlayerHand.length === 0;
        const checkDetails = handIsEmpty
          ? { callerId: playerId, playersYetToPlay: [] } 
          : context.checkDetails;
        
        if (handIsEmpty) {
          newPlayers[playerId]!.isLocked = true;
        }

        return { 
          players: newPlayers, 
          discardPile: newDiscardPile, 
          matchingOpportunity: null, 
          checkDetails,
          discardPileIsSealed: true 
        };
    }),
    handlePlayerPassedOnMatch: assign({
      matchingOpportunity: ({ context, event }) => {
        assertEvent(event, PlayerActionType.PASS_ON_MATCH_ATTEMPT);
        const newOpp = { ...context.matchingOpportunity! };
        newOpp.remainingPlayerIDs = newOpp.remainingPlayerIDs.filter(id => id !== event.playerId);
        return newOpp;
      }
    }),
    clearMatchingOpportunity: assign({ matchingOpportunity: null }),
    setCheckCaller: assign({
      checkDetails: ({ event }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        return { callerId: event.playerId, playersYetToPlay: [] };
      },
    }),
    lockPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        const newPlayers = { ...context.players };
        newPlayers[event.playerId]!.isLocked = true;
        return newPlayers;
      },
    }),
    setupCheckRound: assign({
      checkDetails: ({ context }) => {
        const { callerId } = context.checkDetails!;
        const callerIndex = context.turnOrder.indexOf(callerId);
        const playersInOrder = [...context.turnOrder.slice(callerIndex + 1), ...context.turnOrder.slice(0, callerIndex)];
        return { callerId, playersYetToPlay: playersInOrder };
      }
    }),
    setNextCheckPlayer: assign({
      currentPlayerId: ({ context }) => {
        return context.checkDetails?.playersYetToPlay[0] ?? null;
      }
    }),
    advanceCheckRound: assign({
      checkDetails: ({ context }) => {
        const newCheckDetails = { ...context.checkDetails! };
        newCheckDetails.playersYetToPlay.shift();
        return newCheckDetails;
      },
    }),
    calculateScoresAndEndRound: assign({
      gameover: ({ context }) => {
        let loserId: PlayerId | null = null;
        let minScore = Infinity;
        
        const playerScores = Object.fromEntries(
          Object.entries(context.players).map(([id, player]) => {
            const score = player.hand.reduce((acc, card) => acc + cardScoreValues[card.rank], 0);
            if (score < minScore) {
              minScore = score;
              loserId = id;
            }
            return [id, score];
          })
        );
        return { winnerId: null, loserId, playerScores };
      }
    }),
    resetForNextRound: assign(({ context }) => ({
        deck: shuffleDeck(createDeck()),
        discardPile: [],
        players: Object.fromEntries(
            Object.entries(context.players).map(([id, player]) => [id, { ...player, hand: [], isReady: false, isLocked: false, hasCalledCheck: false, pendingDrawnCard: null }])
        ),
        currentPlayerId: null,
        currentTurnSegment: null,
        checkDetails: null,
        gameover: null,
        lastRoundLoserId: context.gameover?.loserId ?? null,
        turnOrder: context.lastRoundLoserId ? [context.lastRoundLoserId, ...context.turnOrder.filter(id => id !== context.lastRoundLoserId)] : context.turnOrder,
    })),
    sendPeekInfoToAllPlayers: enqueueActions(({ context, enqueue }) => {
      context.turnOrder.forEach((playerId) => {
        const player = context.players[playerId]!;
        enqueue.emit({
          type: 'SEND_EVENT_TO_PLAYER',
          payload: {
            playerId,
            eventName: SocketEventName.INITIAL_PEEK_INFO,
            eventData: { hand: [player.hand[2], player.hand[3]] },
          },
        });
      });
    }),
    activateAbility: assign({
        activeAbility: ({ context }) => {
            const card = context.discardPile[context.discardPile.length - 1]!;
            const type: AbilityType = card.rank === CardRank.King ? 'king'
              : (card.rank === CardRank.Queen ? 'peek' : 'swap');
            const newAbility: ActiveAbility = {
                type,
                stage: type === 'swap' ? 'swapping' : 'peeking',
                playerId: context.currentPlayerId!,
            };
            return newAbility;
        },
        currentTurnSegment: TurnPhase.ABILITY,
    }),
    sendPeekResults: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { payload, playerId } = event;
      if (payload.action !== 'peek') return;
    
      payload.targets.forEach(target => {
        const targetPlayer = context.players[target.playerId];
        const card = targetPlayer?.hand[target.cardIndex];
        if (card) {
          enqueue.emit({
            type: 'SEND_EVENT_TO_PLAYER',
            payload: {
              playerId: playerId,
              eventName: SocketEventName.ABILITY_PEEK_RESULT,
              eventData: { card, playerId: target.playerId, cardIndex: target.cardIndex },
            }
          });
        }
      });
    }),
    performAbilityAction: assign((
      { context, event }) => {
        assertEvent(event, PlayerActionType.USE_ABILITY);
        const { payload, playerId } = event;
        const { activeAbility } = context;

        if (!activeAbility || activeAbility.playerId !== playerId) return {};

        const newPlayers = { ...context.players };
        let newActiveAbility = { ...activeAbility };

        if (payload.action === 'skip') {
            if ((newActiveAbility.type === 'king' || newActiveAbility.type === 'peek') && newActiveAbility.stage === 'peeking') {
                newActiveAbility.stage = 'swapping';
                return { activeAbility: newActiveAbility };
            }
            return { activeAbility: null };
        }

        if (payload.action === 'peek' && newActiveAbility.stage === 'peeking') {
            newActiveAbility.stage = 'swapping';
            return { activeAbility: newActiveAbility };
        }

        if (payload.action === 'swap' && newActiveAbility.stage === 'swapping') {
            const { source, target } = payload;
            const sourcePlayer = newPlayers[source.playerId];
            const targetPlayer = newPlayers[target.playerId];

            if (!sourcePlayer || !targetPlayer) return {};

            const sourceCard = sourcePlayer.hand[source.cardIndex];
            const targetCard = targetPlayer.hand[target.cardIndex];

            if (!sourceCard || !targetCard) return {};

            const newSourceHand = [...sourcePlayer.hand];
            const newTargetHand = [...targetPlayer.hand];

            newSourceHand[source.cardIndex] = targetCard;
            newTargetHand[target.cardIndex] = sourceCard;

            newPlayers[source.playerId]!.hand = newSourceHand;
            newPlayers[target.playerId]!.hand = newTargetHand;
            
            return { players: newPlayers, activeAbility: null };
        }

        return {};
    }),
  },
  actors: {
    peekTimerActor: fromPromise(async () => {
      await new Promise((resolve) => setTimeout(resolve, PEEK_TOTAL_DURATION_MS));
      return {};
    }),
    matchingTimerActor: fromPromise(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return {};
    }),
  },
}).createMachine({
  id: 'game',
  initial: GameStage.WAITING_FOR_PLAYERS,
  context: ({ input }) => ({
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
  on: {
    PLAYER_RECONNECTED: {
      actions: [
        'setPlayerConnected',
        'emitPlayerReconnectSuccessful',
        'addPlayerReconnectedLog',
        'broadcastGameState',
      ],
    },
    PLAYER_DISCONNECTED: {
      actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'],
    },
  },
  states: {
    [GameStage.WAITING_FOR_PLAYERS]: {
      on: {
        PLAYER_JOIN_REQUEST: {
          guard: 'canJoinGame',
          actions: [
            'createPlayer',
            'emitPlayerJoinSuccessful',
            'addPlayerJoinedLog',
            'broadcastGameState',
          ],
        },
        [PlayerActionType.DECLARE_LOBBY_READY]: {
          actions: ['setPlayerReady', 'broadcastGameState'],
        },
        [PlayerActionType.START_GAME]: {
          guard: and(['isGameMaster', 'areAllPlayersReady']),
          target: GameStage.DEALING,
        },
        [PlayerActionType.SEND_CHAT_MESSAGE]: {
          actions: ['addChatMessage', 'broadcastGameState'],
        },
      },
    },
    [GameStage.DEALING]: {
      entry: [ 'dealCards', 'setAllPlayersToPlaying', 'broadcastGameState' ],
      after: {
        100: { target: GameStage.INITIAL_PEEK },
      },
    },
    [GameStage.INITIAL_PEEK]: {
      entry: ['resetPlayersReadyStatus', 'sendPeekInfoToAllPlayers', 'broadcastGameState'],
      invoke: {
        id: 'peekTimer',
        src: 'peekTimerActor',
        onDone: { target: GameStage.PLAYING },
      },
      on: {
        [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
          actions: ['setPlayerReadyForPeek', 'broadcastGameState'],
        },
      },
      always: {
        guard: 'allPlayersReadyForPeek',
        target: GameStage.PLAYING,
      },
    },
    [GameStage.PLAYING]: {
      initial: 'turn',
      entry: ['initializePlayState', 'broadcastGameState'],
      on: {
        [PlayerActionType.CALL_CHECK]: {
          guard: and(['isPlayerTurn', 'isNotLocked']),
          target: GameStage.CHECK,
          actions: ['setCheckCaller', 'lockPlayer'],
        },
        [PlayerActionType.SEND_CHAT_MESSAGE]: {
          actions: ['addChatMessage', 'broadcastGameState'],
        },
      },
      states: {
        turn: {
          initial: 'DRAW',
          states: {
            DRAW: {
              entry: ['broadcastGameState'],
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: { guard: 'isPlayerTurn', actions: 'drawFromDeck', target: 'DISCARD' },
                [PlayerActionType.DRAW_FROM_DISCARD]: { guard: and(['isPlayerTurn', 'canDrawFromDiscard']), actions: 'drawFromDiscard', target: 'DISCARD' },
              },
            },
            DISCARD: {
              entry: 'broadcastGameState',
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'action' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'action' },
              },
            },
            action: {
              always: [
                { guard: ({ context }) => !!context.activeAbility, target: 'ABILITY' },
                { guard: 'isAbilityCardDiscarded', target: 'ABILITY', actions: 'activateAbility' },
                { target: 'MATCHING' },
              ],
            },
            ABILITY: {
              entry: ['broadcastGameState'],
              on: {
                [PlayerActionType.USE_ABILITY]: {
                  guard: 'isValidAbilityAction',
                  actions: ['performAbilityAction', 'sendPeekResults', 'broadcastGameState'],
                  target: 'action',
                }
              }
            },
            MATCHING: {
              entry: ['setupMatchingOpportunity', 'broadcastGameState'],
              invoke: {
                id: 'matchingTimer',
                src: 'matchingTimerActor',
                onDone: { target: 'endOfTurn', actions: 'clearMatchingOpportunity' },
              },
              on: {
                [PlayerActionType.ATTEMPT_MATCH]: [
                    {
                        guard: and(['canAttemptMatch', 'matchWillEmptyHand']),
                        actions: 'handleSuccessfulMatch',
                        target: `#game.${GameStage.CHECK}`
                    },
                    {
                        guard: 'canAttemptMatch',
                        actions: 'handleSuccessfulMatch',
                        target: 'endOfTurn'
                    }
                ],
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: {
                    actions: ['handlePlayerPassedOnMatch', 'broadcastGameState'],
                }
              },
              always: {
                guard: ({ context }) => context.matchingOpportunity?.remainingPlayerIDs.length === 0,
                target: 'endOfTurn',
                actions: 'clearMatchingOpportunity',
              }
            },
            endOfTurn: {
                entry: ['setNextPlayer', 'broadcastGameState'],
                after: { 10: 'DRAW' }
            }
          },
        },
      },
    },
    [GameStage.CHECK]: {
      initial: 'turn',
      entry: ['setupCheckRound', 'setNextCheckPlayer', 'broadcastGameState'],
      always: {
        guard: ({ context }) => !context.currentPlayerId,
        target: GameStage.GAMEOVER,
      },
      states: {
        turn: {
          initial: 'DRAW',
          states: {
            DRAW: {
              entry: ['broadcastGameState'],
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: { guard: 'isPlayerTurn', actions: 'drawFromDeck', target: 'DISCARD' },
                [PlayerActionType.DRAW_FROM_DISCARD]: { guard: and(['isPlayerTurn', 'canDrawFromDiscard']), actions: 'drawFromDiscard', target: 'DISCARD' },
              },
            },
            DISCARD: {
              entry: 'broadcastGameState',
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'action' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'action' },
              },
            },
            action: {
              always: [
                { guard: ({ context }) => !!context.activeAbility, target: 'ABILITY' },
                { guard: 'isAbilityCardDiscarded', target: 'ABILITY', actions: 'activateAbility' },
                { target: 'MATCHING' },
              ],
            },
            ABILITY: {
              entry: ['broadcastGameState'],
              on: {
                [PlayerActionType.USE_ABILITY]: {
                  guard: 'isValidAbilityAction',
                  actions: ['performAbilityAction', 'sendPeekResults', 'broadcastGameState'],
                  target: 'action',
                }
              }
            },
            MATCHING: {
              entry: ['setupMatchingOpportunity', 'broadcastGameState'],
              invoke: {
                id: 'matchingTimer',
                src: 'matchingTimerActor',
                onDone: { target: 'endOfTurn', actions: 'clearMatchingOpportunity' },
              },
              on: {
                [PlayerActionType.ATTEMPT_MATCH]: {
                    guard: 'canAttemptMatch',
                    actions: 'handleSuccessfulMatch',
                    target: 'endOfTurn'
                },
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: {
                    actions: 'handlePlayerPassedOnMatch',
                }
              },
              always: {
                guard: ({ context }) => context.matchingOpportunity?.remainingPlayerIDs.length === 0,
                target: 'endOfTurn',
                actions: 'clearMatchingOpportunity',
              }
            },
            endOfTurn: {
                entry: ['advanceCheckRound', 'setNextCheckPlayer', 'broadcastGameState'],
                always: [
                  {
                    guard: ({ context }) => !context.currentPlayerId,
                    target: `#game.${GameStage.GAMEOVER}`
                  },
                  { target: 'DRAW' }
                ]
            }
          },
        },
      },
    },
    [GameStage.GAMEOVER]: {
      entry: ['calculateScoresAndEndRound', 'broadcastGameState'],
      on: {
        [PlayerActionType.PLAY_AGAIN]: {
          actions: ['resetForNextRound', 'broadcastGameState'],
          target: GameStage.DEALING,
        },
      },
    },
  },
});