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
import logger from './lib/logger.js';
import 'xstate/guards';

// #region Constants & Server-Side Types
const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '10000', 10);
const MATCHING_STAGE_DURATION_MS = parseInt(process.env.MATCHING_STAGE_DURATION_MS || '5000', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '4', 10);
const CARDS_PER_PLAYER = parseInt(process.env.CARDS_PER_PLAYER || '4', 10);
const RECONNECT_TIMEOUT_MS = parseInt(process.env.RECONNECT_TIMEOUT_MS || '30000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);

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
  errorState: {
    message: string;
    retryCount: number;
    errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR' | null;
    affectedPlayerId?: PlayerId;
    recoveryState?: any;
  } | null;
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
  | { type: 'CLIENT_ERROR_REPORT'; playerId: PlayerId; errorType: string; message: string; context?: any }
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
    }
  | { 
      type: 'LOG_ERROR';
      error: Error;
      errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR';
      playerId?: PlayerId;
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
    canJoinGame: ({ context }) => {
      const result = Object.keys(context.players).length < MAX_PLAYERS;
      logger.debug({ gameId: context.gameId, result }, 'Guard: canJoinGame');
      return result;
    },
    isGameMaster: ({ context, event }) => {
      assertEvent(event, PlayerActionType.START_GAME);
      const result = event.playerId === context.gameMasterId;
      logger.debug({ gameId: context.gameId, playerId: event.playerId, gameMasterId: context.gameMasterId, result }, 'Guard: isGameMaster');
      return result;
    },
    areAllPlayersReady: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter((p) => p.isConnected);
      if (connectedPlayers.length < 2) {
        logger.debug({ gameId: context.gameId, connectedPlayerCount: connectedPlayers.length }, 'Guard: areAllPlayersReady (fail: not enough players)');
        return false;
      }
      const result = connectedPlayers.every((p) => p.isReady);
      logger.debug({ gameId: context.gameId, result, players: connectedPlayers.map(p=>({id: p.id, isReady: p.isReady})) }, 'Guard: areAllPlayersReady');
      return result;
    },
    allPlayersReadyForPeek: ({ context }) => {
      const result = context.turnOrder.every((id) => context.players[id]?.isReady);
      logger.debug({ gameId: context.gameId, result }, 'Guard: allPlayersReadyForPeek');
      return result;
    },
    isPlayerTurn: ({ context, event }) => {
      assertEvent(event, [
        PlayerActionType.DRAW_FROM_DECK,
        PlayerActionType.DRAW_FROM_DISCARD,
        PlayerActionType.SWAP_AND_DISCARD,
        PlayerActionType.DISCARD_DRAWN_CARD,
        PlayerActionType.CALL_CHECK,
      ]);
      const result = event.playerId === context.currentPlayerId;
      if (!result) {
        logger.warn({ gameId: context.gameId, event: event.type, playerId: event.playerId, currentPlayerId: context.currentPlayerId }, 'Guard: isPlayerTurn (fail)');
      }
      return result;
    },
    hasDrawnCard: ({ context, event }) => {
      assertEvent(event, [PlayerActionType.SWAP_AND_DISCARD, PlayerActionType.DISCARD_DRAWN_CARD]);
      const result = !!context.players[event.playerId]?.pendingDrawnCard;
      logger.debug({ gameId: context.gameId, playerId: event.playerId, result }, 'Guard: hasDrawnCard');
      return result;
    },
    wasDrawnFromDeck: ({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const drawnInfo = context.players[event.playerId]?.pendingDrawnCard;
      const result = drawnInfo?.source === 'deck';
      logger.debug({ gameId: context.gameId, playerId: event.playerId, result, source: drawnInfo?.source }, 'Guard: wasDrawnFromDeck');
      return result;
    },
    canDrawFromDiscard: ({ context }) => {
      if (context.discardPileIsSealed) {
        logger.debug({ gameId: context.gameId }, 'Guard: canDrawFromDiscard (fail: sealed)');
        return false;
      }
      const topOfDiscard = context.discardPile[context.discardPile.length - 1];
      if (!topOfDiscard) {
        logger.debug({ gameId: context.gameId }, 'Guard: canDrawFromDiscard (fail: empty)');
        return false;
      }
      const result = !specialRanks.has(topOfDiscard.rank);
      logger.debug({ gameId: context.gameId, result, topCard: topOfDiscard.rank }, 'Guard: canDrawFromDiscard');
      return result;
    },
    matchWillEmptyHand: ({ context, event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        const result = context.players[event.playerId]!.hand.length === 1;
        logger.debug({ gameId: context.gameId, playerId: event.playerId, result }, 'Guard: matchWillEmptyHand');
        return result;
    },
    isAbilityCardDiscarded: ({ context }) => {
      const topCard = context.discardPile[context.discardPile.length - 1];
      if (!topCard) return false;
      const result = abilityRanks.has(topCard.rank);
      logger.debug({ gameId: context.gameId, result, topCard: topCard.rank }, 'Guard: isAbilityCardDiscarded');
      return result;
    },
    canAttemptMatch: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload } = event;
      const { matchingOpportunity } = context;
      if (!matchingOpportunity) {
        logger.debug({ gameId: context.gameId, playerId }, 'Guard: canAttemptMatch (fail: no opportunity)');
        return false;
      }

      const player = context.players[playerId];
      const cardInHand = player?.hand[payload.handCardIndex];
      const result = !!cardInHand && cardInHand.rank === matchingOpportunity.cardToMatch.rank;
      logger.debug({ gameId: context.gameId, playerId, result, cardInHand: cardInHand?.rank, cardToMatch: matchingOpportunity.cardToMatch.rank }, 'Guard: canAttemptMatch');
      return result;
    },
    isValidAbilityAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId } = event;
      const { activeAbility } = context;
      if (!activeAbility || activeAbility.playerId !== playerId) {
        logger.warn({ gameId: context.gameId, playerId, activeAbility }, 'Guard: isValidAbilityAction (fail)');
        return false;
      }
      return true;
    },
    isNotLocked: ({ context, event }) => {
      assertEvent(event, PlayerActionType.CALL_CHECK);
      const result = !context.players[event.playerId]?.isLocked;
      logger.debug({ gameId: context.gameId, playerId: event.playerId, result }, 'Guard: isNotLocked');
      return result;
    },
    canRetry: ({ context }) => {
      const result = context.errorState !== null && context.errorState.retryCount < MAX_RETRIES;
      logger.debug({ gameId: context.gameId, result, errorState: context.errorState }, 'Guard: canRetry');
      return result;
    },
    isDeckEmpty: ({ context }) => {
      const result = context.deck.length === 0;
      if (result) {
        logger.warn({ gameId: context.gameId }, 'Guard: isDeckEmpty');
      }
      return result;
    },
    hasRecoveryState: ({ context }) => {
      const result = context.errorState !== null && context.errorState.recoveryState !== undefined;
      logger.debug({ gameId: context.gameId, result, errorState: context.errorState }, 'Guard: hasRecoveryState');
      return result;
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
      logger.info({ event }, 'Action: emitPlayerReconnectSuccessful');
      return { type: 'PLAYER_RECONNECT_SUCCESSFUL' as const, playerId: event.playerId };
    }),
    createPlayer: assign({
      players: ({ context, event }) => {
        assertEvent(event, 'PLAYER_JOIN_REQUEST');
        logger.info({ gameId: context.gameId, playerId: event.playerId, playerName: event.playerSetupData.name }, 'Action: createPlayer');
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
          logger.info({ gameId: context.gameId, playerId: event.playerId, newSocketId: event.newSocketId }, 'Action: setPlayerConnected');
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
        if (newPlayers[event.playerId]) {
          logger.info({ gameId: context.gameId, playerId: event.playerId }, 'Action: setPlayerDisconnected');
          newPlayers[event.playerId]!.isConnected = false;
        }
        return newPlayers;
      },
    }),
    setPlayerReady: assign({
      players: ({ context, event }) => {
        assertEvent(event, PlayerActionType.DECLARE_LOBBY_READY);
        const newPlayers = { ...context.players };
        if (newPlayers[event.playerId]) {
          logger.info({ gameId: context.gameId, playerId: event.playerId }, 'Action: setPlayerReady');
          newPlayers[event.playerId]!.isReady = true;
        }
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
          logger.warn({ gameId: context.gameId, event }, 'Game Log: Player disconnected');
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
      logger.info({ gameId: context.gameId, players: context.turnOrder }, 'Action: dealCards');
      const newPlayers: Record<PlayerId, ServerPlayer> = JSON.parse(JSON.stringify(context.players));
      const newDeck = [...context.deck];

      for (let i = 0; i < CARDS_PER_PLAYER; i++) {
        for (const playerId of context.turnOrder) {
          const card = newDeck.pop();
          if (card) newPlayers[playerId]!.hand.push(card);
        }
      }

      return { players: newPlayers, deck: newDeck };
    }),
    initializePlayState: assign({
      currentPlayerId: ({ context }) => {
        logger.info({ gameId: context.gameId, turnOrder: context.turnOrder }, 'Action: initializePlayState');
        return context.turnOrder[0]!;
      },
      currentTurnSegment: TurnPhase.DRAW,
    }),
    setNextPlayer: assign(({ context }) => {
        const { currentPlayerId, turnOrder } = context;
        const currentIndex = turnOrder.indexOf(currentPlayerId!);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        const nextPlayerId = turnOrder[nextIndex]!;
        logger.info({ gameId: context.gameId, currentPlayerId, nextPlayerId }, 'Action: setNextPlayer');
        return { currentPlayerId: nextPlayerId };
    }),
    drawFromDeck: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DECK);
      const { playerId } = event;
      logger.info({ gameId: context.gameId, playerId }, 'Action: drawFromDeck');
      
      // If deck is empty, just set the error state
      if (context.deck.length === 0) {
        logger.error({ gameId: context.gameId, playerId }, 'Action: drawFromDeck (DECK EMPTY)');
        return {
          errorState: {
            message: 'The deck is empty. Reshuffling discard pile...',
            retryCount: 0,
            errorType: 'DECK_EMPTY' as const,
            affectedPlayerId: playerId,
            recoveryState: {
              activeState: context.currentTurnSegment,
              currentPlayerId: context.currentPlayerId
            }
          }
        };
      }
      
      // Proceed with drawing if deck has cards
      const [drawnCard, ...remainingDeck] = context.deck;
      const newPlayers = { ...context.players };
      newPlayers[playerId]!.pendingDrawnCard = { card: drawnCard, source: 'deck' };
      
      return { 
        players: newPlayers, 
        deck: remainingDeck,
        currentTurnSegment: TurnPhase.DISCARD
      };
    }),
    drawFromDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DISCARD);
      const newDiscard = [...context.discardPile];
      const drawnCard = newDiscard.pop();
      logger.info({ gameId: context.gameId, playerId: event.playerId, drawnCard }, 'Action: drawFromDiscard');
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
      logger.info({ gameId: context.gameId, playerId, handCardIndex, drawnCard: drawn?.card }, 'Action: swapAndDiscard');
      if (!drawn) return {};
      
      const newPlayers = { ...context.players };
      
      // Card being swapped out (going to discard)
      const cardToDiscard = player.hand[handCardIndex]!;
      
      // Update player's hand with drawn card
      const newHand = [...player.hand];
      newHand[handCardIndex] = drawn.card;
      newPlayers[playerId]!.hand = newHand;
      newPlayers[playerId]!.pendingDrawnCard = null;
      
      const newDiscardPile = [...context.discardPile, cardToDiscard];
      
      // Check if discarded card is special
      const isSpecialCard = specialRanks.has(cardToDiscard.rank);
      let activeAbility = null;
      
      if (isSpecialCard) {
        const type: AbilityType = cardToDiscard.rank === CardRank.King ? 'king' 
          : (cardToDiscard.rank === CardRank.Queen ? 'peek' : 'swap');
        
        activeAbility = {
          type,
          stage: type === 'swap' ? 'swapping' : 'peeking' as 'swapping' | 'peeking',
          playerId,
        };
      }
      
      return { 
        players: newPlayers, 
        discardPile: newDiscardPile,
        activeAbility,
        currentTurnSegment: isSpecialCard ? TurnPhase.ABILITY : context.currentTurnSegment
      };
    }),
    discardDrawnCard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const player = context.players[event.playerId]!;
      const drawn = player.pendingDrawnCard;
      logger.info({ gameId: context.gameId, playerId: event.playerId, drawnCard: drawn?.card }, 'Action: discardDrawnCard');
      if (!drawn) return {};
      
      const newPlayers = { ...context.players };
      newPlayers[event.playerId]!.pendingDrawnCard = null;
      const newDiscardPile = [...context.discardPile, drawn.card];
      
      // If it's a special card (King, Queen, Jack), set up the active ability
      const isSpecialCard = specialRanks.has(drawn.card.rank);
      let activeAbility = null;
      
      if (isSpecialCard) {
        const type: AbilityType = drawn.card.rank === CardRank.King ? 'king' 
          : (drawn.card.rank === CardRank.Queen ? 'peek' : 'swap');
        
        activeAbility = {
          type,
          stage: type === 'swap' ? 'swapping' : 'peeking' as 'swapping' | 'peeking',
          playerId: event.playerId
        };
      }
      
      return { 
        players: newPlayers, 
        discardPile: newDiscardPile,
        activeAbility,
        currentTurnSegment: isSpecialCard ? TurnPhase.ABILITY : context.currentTurnSegment
      };
    }),
    setupMatchingOpportunity: assign({
      matchingOpportunity: ({ context }) => {
        const cardToMatch = context.discardPile[context.discardPile.length - 1];
        logger.info({ gameId: context.gameId, cardToMatch, currentPlayerId: context.currentPlayerId }, 'Action: setupMatchingOpportunity');
        if (!cardToMatch || specialRanks.has(cardToMatch.rank)) return null;
        
        const originalPlayerID = context.currentPlayerId!;
        const otherPlayerIDs = context.turnOrder.filter(id => id !== originalPlayerID);

        return { cardToMatch, originalPlayerID, remainingPlayerIDs: otherPlayerIDs };
      },
    }),
    handleSuccessfulMatch: assign(({ context, event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        const { playerId, payload: { handCardIndex } } = event;
        logger.info({ gameId: context.gameId, playerId, handCardIndex }, 'Action: handleSuccessfulMatch');
        const matchingPlayer = context.players[playerId]!;

        const cardToPlaceOnPile = matchingPlayer.hand[handCardIndex]!;
        
        const newPlayers = { ...context.players };
        const newMatchingPlayerHand = [...matchingPlayer.hand];
        newMatchingPlayerHand.splice(handCardIndex, 1);
        newPlayers[playerId]!.hand = newMatchingPlayerHand;
        
        const newDiscardPile = [...context.discardPile, cardToPlaceOnPile];

        const handIsEmpty = newMatchingPlayerHand.length === 0;
        let checkDetails = context.checkDetails;
        
        if (handIsEmpty) {
          // Player emptied their hand through matching, automatically call check
          newPlayers[playerId]!.isLocked = true;
          newPlayers[playerId]!.hasCalledCheck = true;
          logger.info({ gameId: context.gameId, playerId }, 'Player emptied hand on match, calling check automatically.');
          
          // Set up check details with this player as the caller
          checkDetails = { callerId: playerId, playersYetToPlay: [] };
          
          // Set up the check round with remaining players
          const callerIndex = context.turnOrder.indexOf(playerId);
          const playersInOrder = [
            ...context.turnOrder.slice(callerIndex + 1),
            ...context.turnOrder.slice(0, callerIndex)
          ];
          checkDetails.playersYetToPlay = playersInOrder;
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
        logger.info({ gameId: context.gameId, playerId: event.playerId }, 'Action: handlePlayerPassedOnMatch');
        const newOpp = { ...context.matchingOpportunity! };
        newOpp.remainingPlayerIDs = newOpp.remainingPlayerIDs.filter(id => id !== event.playerId);
        return newOpp;
      }
    }),
    clearMatchingOpportunity: assign({ 
      matchingOpportunity: ({context}) => {
        logger.info({gameId: context.gameId}, 'Action: clearMatchingOpportunity');
        return null;
      }
    }),
    setCheckCaller: assign({
      checkDetails: ({ event, context }) => {
        assertEvent(event, PlayerActionType.CALL_CHECK);
        logger.info({ gameId: context.gameId, playerId: event.playerId }, 'Action: setCheckCaller');
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
        logger.info({ gameId: context.gameId, callerId, playersInOrder }, 'Action: setupCheckRound');
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
        logger.info({ gameId: context.gameId }, 'Action: calculateScoresAndEndRound');
        let winnerId: PlayerId | null = null;
        let loserId: PlayerId | null = null;
        let minScore = Infinity;
        let maxScore = -1;
        
        const playerScores = Object.fromEntries(
          Object.entries(context.players).map(([id, player]) => {
            const score = player.hand.reduce((acc, card) => acc + cardScoreValues[card.rank], 0);
            if (score < minScore) {
              minScore = score;
              winnerId = id;
            }
            if (score > maxScore) {
                maxScore = score;
                loserId = id;
            }
            return [id, score];
          })
        );
        logger.info({ gameId: context.gameId, playerScores, winnerId, loserId }, 'Game over scores calculated.');
        return { winnerId, loserId, playerScores };
      }
    }),
    resetForNextRound: assign(({ context }) => {
        logger.info({ gameId: context.gameId }, 'Action: resetForNextRound');
        const lastRoundLoserId = context.gameover?.loserId;
        const newTurnOrder = lastRoundLoserId ? [lastRoundLoserId, ...context.turnOrder.filter(id => id !== lastRoundLoserId)] : context.turnOrder;
        const newDealerId = newTurnOrder[0];

        const newPlayers = Object.fromEntries(
            Object.entries(context.players).map(([id, player]) => [id, { 
                ...player,
                hand: [],
                isReady: false,
                isLocked: false,
                hasCalledCheck: false,
                pendingDrawnCard: null,
                isDealer: id === newDealerId,
            }])
        );
        
        return {
            deck: shuffleDeck(createDeck()),
            discardPile: [],
            players: newPlayers,
            currentPlayerId: null,
            currentTurnSegment: null,
            checkDetails: null,
            gameover: null,
            lastRoundLoserId: lastRoundLoserId ?? null,
            turnOrder: newTurnOrder,
        };
    }),
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
        logger.info({ gameId: context.gameId, playerId, payload, activeAbility }, 'Action: performAbilityAction');

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
    logError: emit(({ context, event }) => {
      let errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR' = 'GENERAL_ERROR';
      let playerId: PlayerId | undefined = undefined;
      let error: Error;
      
      if (event.type === 'PLAYER_DISCONNECTED') {
        errorType = 'NETWORK_ERROR';
        playerId = event.playerId;
        error = new Error(`Player ${getPlayerNameForLog(event.playerId, context)} disconnected`);
      } else {
        error = new Error('Game error occurred');
      }
      
      logger.error({ err: error, gameId: context.gameId, event, errorType, playerId }, 'Action: logError');
      
      return {
        type: 'LOG_ERROR' as const,
        error,
        errorType,
        playerId
      };
    }),
    setErrorState: assign({
      errorState: ({ context, event }) => {
        let errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR' = 'GENERAL_ERROR';
        let message = 'An error occurred in the game';
        let playerId: PlayerId | undefined = undefined;
        
        if (event.type === 'PLAYER_DISCONNECTED') {
          errorType = 'NETWORK_ERROR';
          playerId = event.playerId;
          message = `Player ${context.players[event.playerId]?.name || 'Unknown'} disconnected`;
        } else if (context.deck.length === 0) {
          errorType = 'DECK_EMPTY';
          message = 'The deck is empty. Reshuffling discard pile...';
        }
        
        logger.warn({ gameId: context.gameId, errorType, message, playerId }, 'Action: setErrorState');
        return {
          message,
          retryCount: 0,
          errorType,
          affectedPlayerId: playerId,
          recoveryState: context.currentTurnSegment ? {
            activeState: context.currentTurnSegment,
            currentPlayerId: context.currentPlayerId
          } : undefined
        };
      }
    }),
    incrementRetryCount: assign({
      errorState: ({ context }) => {
        if (!context.errorState) return null;
        logger.warn({ gameId: context.gameId, retryCount: context.errorState.retryCount + 1 }, 'Action: incrementRetryCount');
        return {
          ...context.errorState,
          retryCount: context.errorState.retryCount + 1
        };
      }
    }),
    clearErrorState: assign({
      errorState: ({context}) => {
        logger.info({ gameId: context.gameId }, 'Action: clearErrorState');
        return null;
      }
    }),
    addErrorLog: assign({
      log: ({ context }) => {
        if (!context.errorState) return context.log;
        
        const logEntry = createLogEntry(context, {
          message: `Error: ${context.errorState.message}. ${
            context.errorState.retryCount < MAX_RETRIES 
              ? `Attempting recovery (try ${context.errorState.retryCount + 1}/${MAX_RETRIES})` 
              : 'Recovery failed'
          }`,
          type: 'public',
          tags: ['system-message', 'error']
        });
        
        return [...context.log, logEntry];
      }
    }),
    reshuffleDeckIfEmpty: assign(({ context }) => {
      if (context.deck.length > 0) return {};
      
      logger.info({ gameId: context.gameId }, 'Action: reshuffleDeckIfEmpty');
      // Create a new deck using the discard pile
      const newDiscardPile: Card[] = [];
      const cardsToReshuffle = [...context.discardPile];
      const topCard = cardsToReshuffle.pop();
      
      if (topCard) newDiscardPile.push(topCard);
      
      return {
        deck: shuffleDeck(cardsToReshuffle),
        discardPile: newDiscardPile,
        errorState: null
      };
    }),
    logClientError: assign({
      log: ({ context, event }) => {
        assertEvent(event, 'CLIENT_ERROR_REPORT');
        const { playerId, errorType, message, context: errorContext } = event;
        const playerName = getPlayerNameForLog(playerId, context);
        
        logger.warn({ gameId: context.gameId, playerId, errorType, message, errorContext }, 'Action: logClientError');

        const logEntry = createLogEntry(context, {
          message: `Client error from ${playerName}: [${errorType}] ${message}${errorContext ? ` (${JSON.stringify(errorContext)})` : ''}`,
          type: 'private',
          tags: ['system-message', 'error']
        });
        
        return [...context.log, logEntry];
      }
    }),
    reshuffleDiscardIntoDeck: assign({
      deck: ({ context }) => {
        // Keep the top card of discard pile
        logger.info({ gameId: context.gameId, discardCount: context.discardPile.length }, 'Action: reshuffleDiscardIntoDeck');
        const discardPileWithoutTop = [...context.discardPile.slice(0, -1)];
        return shuffleDeck(discardPileWithoutTop);
      },
      discardPile: ({ context }) => {
        // Keep only the top card
        const topCard = context.discardPile[context.discardPile.length - 1];
        return topCard ? [topCard] : [];
      },
      errorState: null
    }),
  },
  actors: {
    peekTimerActor: fromPromise(async () => {
      await new Promise((resolve) => setTimeout(resolve, PEEK_TOTAL_DURATION_MS));
      return {};
    }),
    matchingTimerActor: fromPromise(async () => {
      await new Promise((resolve) => setTimeout(resolve, MATCHING_STAGE_DURATION_MS));
      return {};
    }),
    reconnectTimerActor: fromPromise(async ({ input }) => {
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_TIMEOUT_MS));
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
    errorState: null,
  }),
  entry: ({ context }) => logger.info({ gameId: context.gameId }, 'Game machine initialized'),
  on: {
    PLAYER_RECONNECTED: {
      actions: [
        'setPlayerConnected',
        'emitPlayerReconnectSuccessful',
        'addPlayerReconnectedLog',
        'broadcastGameState',
      ],
    },
    PLAYER_DISCONNECTED: [
      {
        target: '.error',
        actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'setErrorState', 'broadcastGameState', 'logError'],
        guard: ({ context, event }) => {
          logger.warn({ gameId: context.gameId, playerId: event.playerId, currentPlayerId: context.currentPlayerId }, 'Player disconnected');
          // Only transition to error if the disconnected player is the current player
          return event.playerId === context.currentPlayerId;
        }
      },
      {
        actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'],
      }
    ],
    CLIENT_ERROR_REPORT: {
      actions: ['logClientError', 'broadcastGameState']
    },
  },
  states: {
    [GameStage.WAITING_FOR_PLAYERS]: {
      entry: ({context}) => logger.info({gameId: context.gameId}, 'State: WAITING_FOR_PLAYERS'),
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
      entry: [ 'dealCards', 'setAllPlayersToPlaying', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId}, 'State: DEALING') ],
      after: {
        100: { target: GameStage.INITIAL_PEEK },
      },
    },
    [GameStage.INITIAL_PEEK]: {
      entry: ['resetPlayersReadyStatus', 'sendPeekInfoToAllPlayers', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId}, 'State: INITIAL_PEEK')],
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
      entry: ['initializePlayState', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId, currentPlayerId: context.currentPlayerId}, 'State: PLAYING')],
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
              entry: ['broadcastGameState', ({context}) => logger.info({gameId: context.gameId, currentPlayerId: context.currentPlayerId}, 'State: PLAYING.turn.DRAW')],
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: [
                  {
                    guard: 'isDeckEmpty',
                    target: '#game.error',
                    actions: 'drawFromDeck'
                  },
                  {
                    guard: 'isPlayerTurn',
                    target: 'DISCARD',
                    actions: 'drawFromDeck'
                  }
                ],
                [PlayerActionType.DRAW_FROM_DISCARD]: { 
                  guard: and(['isPlayerTurn', 'canDrawFromDiscard']), 
                  actions: 'drawFromDiscard', 
                  target: 'DISCARD' 
                },
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
                { target: 'MATCHING' },
              ],
            },
            ABILITY: {
              entry: ['broadcastGameState', ({context}) => logger.info({gameId: context.gameId, activeAbility: context.activeAbility}, 'State: PLAYING.turn.ABILITY')],
              on: {
                [PlayerActionType.USE_ABILITY]: {
                  guard: 'isValidAbilityAction',
                  actions: ['performAbilityAction', 'sendPeekResults', 'broadcastGameState'],
                  target: 'action',
                }
              }
            },
            MATCHING: {
              entry: ['setupMatchingOpportunity', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId, matchingOpportunity: context.matchingOpportunity}, 'State: PLAYING.turn.MATCHING')],
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
                        target: '#game.CHECK'
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
      entry: ['setupCheckRound', 'setNextCheckPlayer', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId, checkDetails: context.checkDetails}, 'State: CHECK')],
      states: {
        turn: {
          initial: 'DRAW',
          states: {
            DRAW: {
              entry: ['broadcastGameState'],
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: [
                  {
                    guard: ({ context }) => context.errorState?.errorType === 'DECK_EMPTY',
                    target: '#game.error',
                    actions: 'drawFromDeck'
                  },
                  {
                    guard: 'isPlayerTurn',
                    target: 'DISCARD',
                    actions: 'drawFromDeck'
                  }
                ],
                [PlayerActionType.DRAW_FROM_DISCARD]: { 
                  guard: and(['isPlayerTurn', 'canDrawFromDiscard']), 
                  actions: 'drawFromDiscard', 
                  target: 'DISCARD' 
                },
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
      entry: ['calculateScoresAndEndRound', 'broadcastGameState', ({context}) => logger.info({gameId: context.gameId}, 'State: GAMEOVER')],
      on: {
        [PlayerActionType.PLAY_AGAIN]: {
          actions: ['resetForNextRound', 'broadcastGameState'],
          target: GameStage.DEALING,
        },
      },
    },
    error: {
      entry: ['addErrorLog', 'broadcastGameState', ({context}) => logger.error({gameId: context.gameId, errorState: context.errorState}, 'State: error')],
      on: {
        PLAYER_RECONNECTED: {
          target: 'recovering',
          actions: ['setPlayerConnected', 'emitPlayerReconnectSuccessful', 'addPlayerReconnectedLog', 'clearErrorState'],
          guard: ({ context, event }) => context.errorState?.affectedPlayerId === event.playerId
        }
      },
      after: {
        [RECONNECT_TIMEOUT_MS]: [
          {
            target: 'recovering',
            guard: 'canRetry',
            actions: 'incrementRetryCount'
          },
          {
            target: 'failedRecovery'
          }
        ]
      }
    },
    recovering: {
      entry: ['broadcastGameState', ({context}) => logger.info({gameId: context.gameId, errorState: context.errorState}, 'State: recovering')],
      always: [
        {
          target: GameStage.PLAYING,
          guard: ({ context }) => {
            return context.errorState === null || 
              (context.errorState.errorType === 'DECK_EMPTY' && context.discardPile.length > 1);
          },
          actions: ['reshuffleDiscardIntoDeck', 'broadcastGameState']
        },
        {
          target: 'failedRecovery'
        }
      ]
    },
    failedRecovery: {
      entry: ['addErrorLog', 'broadcastGameState', ({context}) => logger.fatal({gameId: context.gameId, errorState: context.errorState}, 'State: failedRecovery')],
      on: {
        [PlayerActionType.PLAY_AGAIN]: {
          actions: ['resetForNextRound', 'clearErrorState', 'broadcastGameState'],
          target: GameStage.DEALING,
        }
      }
    },
  },
});