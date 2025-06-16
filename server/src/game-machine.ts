import { setup, assign, fromPromise, assertEvent, emit, and, not, enqueueActions, raise } from 'xstate';
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

// #region Types and Constants
const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '10000', 10);
const MATCHING_STAGE_DURATION_MS = parseInt(process.env.MATCHING_STAGE_DURATION_MS || '5000', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '4', 10);
const CARDS_PER_PLAYER = parseInt(process.env.CARDS_PER_PLAYER || '4', 10);
const RECONNECT_TIMEOUT_MS = parseInt(process.env.RECONNECT_TIMEOUT_MS || '30000', 10);
const LOBBY_DISCONNECT_TIMEOUT_MS = parseInt(process.env.LOBBY_DISCONNECT_TIMEOUT_MS || '5000', 10);

export interface ServerActiveAbility extends Omit<ActiveAbility, 'stage'> {
  stage: 'peeking' | 'swapping';
  source: 'discard' | 'stack' | 'stackSecondOfPair';
  remainingPeeks?: number;
}
export interface ServerPlayer { id: PlayerId; name: string; socketId: string; hand: Card[]; isReady: boolean; isDealer: boolean; hasCalledCheck: boolean; isLocked: boolean; score: number; isConnected: boolean; status: PlayerStatus; pendingDrawnCard: { card: Card; source: 'deck' | 'discard'; } | null; forfeited: boolean; }
export interface GameContext { gameId: string; deck: Card[]; players: Record<PlayerId, ServerPlayer>; discardPile: Card[]; turnOrder: PlayerId[]; gameMasterId: PlayerId | null; currentPlayerId: PlayerId | null; currentTurnSegment: TurnPhase | null; gameStage: GameStage; matchingOpportunity: { cardToMatch: Card; originalPlayerID: PlayerId; remainingPlayerIDs: PlayerId[]; } | null; abilityStack: ServerActiveAbility[]; checkDetails: { callerId: PlayerId; finalTurnOrder: PlayerId[]; finalTurnIndex: number; } | null; gameover: { winnerIds: PlayerId[]; loserId: PlayerId | null; playerScores: Record<PlayerId, number>; } | null; lastRoundLoserId: PlayerId | null; log: RichGameLogMessage[]; chat: ChatMessage[]; discardPileIsSealed: boolean; errorState: { message: string; retryCount: number; errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR' | null; affectedPlayerId?: PlayerId; recoveryState?: any; } | null; maxPlayers: number; cardsPerPlayer: number; winnerId: PlayerId | null; }
type GameInput = { gameId: string; maxPlayers?: number; cardsPerPlayer?: number; };
type PlayerActionEvents = | { type: PlayerActionType.START_GAME; playerId: PlayerId; } | { type: PlayerActionType.DECLARE_LOBBY_READY; playerId: PlayerId; } | { type: PlayerActionType.DRAW_FROM_DECK; playerId: PlayerId } | { type: PlayerActionType.DRAW_FROM_DISCARD; playerId: PlayerId } | { type: PlayerActionType.SWAP_AND_DISCARD; playerId: PlayerId; payload: { handCardIndex: number } } | { type: PlayerActionType.DISCARD_DRAWN_CARD; playerId: PlayerId } | { type: PlayerActionType.ATTEMPT_MATCH; playerId: PlayerId; payload: { handCardIndex: number } } | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT; playerId: PlayerId } | { type: PlayerActionType.CALL_CHECK; playerId: PlayerId } | { type: PlayerActionType.DECLARE_READY_FOR_PEEK; playerId: PlayerId } | { type: PlayerActionType.PLAY_AGAIN; playerId: PlayerId } | { type: PlayerActionType.USE_ABILITY; playerId: PlayerId; payload: AbilityActionPayload } | { type: PlayerActionType.SEND_CHAT_MESSAGE, payload: Omit<ChatMessage, 'id' | 'timestamp'> } | { type: PlayerActionType.LEAVE_GAME; playerId: PlayerId } | { type: PlayerActionType.REMOVE_PLAYER; playerId: PlayerId; payload: { playerIdToRemove: string } };
type GameEvent = | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData; playerId: PlayerId } | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string } | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId } | { type: 'CLIENT_ERROR_REPORT'; playerId: PlayerId; errorType: string; message: string; context?: any } | PlayerActionEvents | { type: 'TIMER.PEEK_EXPIRED' } | { type: 'TIMER.MATCHING_EXPIRED' } | { type: 'LOBBY_DISCONNECT_TIMEOUT'; playerId: PlayerId };
type EmittedEvent = | { type: 'BROADCAST_GAME_STATE' } | { type: 'BROADCAST_CHAT_MESSAGE', chatMessage: ChatMessage } | { type: 'PLAYER_JOIN_SUCCESSFUL'; playerId: PlayerId } | { type: 'PLAYER_RECONNECT_SUCCESSFUL'; playerId: PlayerId } | { type: 'SEND_EVENT_TO_PLAYER'; payload: { playerId: PlayerId; eventName: SocketEventName; eventData: unknown; } } | { type: 'LOG_ERROR'; error: Error; errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR'; playerId?: PlayerId; };
const getPlayerNameForLog = (playerId: string, context: GameContext): string => context.players[playerId]?.name || 'P-' + playerId.slice(-4);
const createLogEntry = (context: GameContext, data: Omit<RichGameLogMessage, 'id' | 'timestamp'>): RichGameLogMessage => ({ id: `log_${context.gameId}_${Date.now()}`, timestamp: new Date().toISOString(), ...data });
const cardScoreValues: Record<CardRank, number> = { [CardRank.Ace]: -1, [CardRank.Two]: 2, [CardRank.Three]: 3, [CardRank.Four]: 4, [CardRank.Five]: 5, [CardRank.Six]: 6, [CardRank.Seven]: 7, [CardRank.Eight]: 8, [CardRank.Nine]: 9, [CardRank.Ten]: 10, [CardRank.Jack]: 11, [CardRank.Queen]: 12, [CardRank.King]: 13 };
const specialRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);
const abilityRanks = new Set([CardRank.King, CardRank.Queen, CardRank.Jack]);
// #endregion

const applyDiscardLogic = (context: GameContext, cardToDiscard: Card, playerId: PlayerId) => {
    let newAbilityStack = [...context.abilityStack];
    if (abilityRanks.has(cardToDiscard.rank)) {
      const type: AbilityType = cardToDiscard.rank === CardRank.King ? 'king' : cardToDiscard.rank === CardRank.Queen ? 'peek' : 'swap';
      const abilityObj: ServerActiveAbility = { type, stage: type === 'king' || type === 'peek' ? 'peeking' : 'swapping', playerId, sourceCard: cardToDiscard, source: 'discard' };
      if (type === 'king') abilityObj.remainingPeeks = 2;
      if (type === 'peek') abilityObj.remainingPeeks = 1;
      newAbilityStack.push(abilityObj);
    }
    return {
      discardPile: [...context.discardPile, cardToDiscard],
      log: [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} discarded a ${cardToDiscard.rank}.`, type: 'public', tags: ['player-action'] })],
      abilityStack: newAbilityStack,
    };
};

export const gameMachine = setup({
  types: { context: {} as GameContext, events: {} as GameEvent, emitted: {} as EmittedEvent, input: {} as GameInput },
  guards: {
    canJoinGame: ({ context }) => Object.keys(context.players).length < context.maxPlayers,
    isGameMaster: ({ context, event }) => {
      assertEvent(event, [PlayerActionType.START_GAME, PlayerActionType.REMOVE_PLAYER]);
      return event.playerId === context.gameMasterId;
    },
    areAllPlayersReady: ({ context }) => {
      const connectedPlayers = Object.values(context.players).filter((p) => p.isConnected);
      return connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.isReady);
    },
    allPlayersReadyForPeek: ({ context }) => context.turnOrder.every((id) => context.players[id]?.isReady),
    isPlayerTurn: ({ context, event }) => {
      assertEvent(event, [ PlayerActionType.DRAW_FROM_DECK, PlayerActionType.DRAW_FROM_DISCARD, PlayerActionType.SWAP_AND_DISCARD, PlayerActionType.DISCARD_DRAWN_CARD, PlayerActionType.CALL_CHECK ]);
      return event.playerId === context.currentPlayerId;
    },
    hasDrawnCard: ({ context, event }) => {
      assertEvent(event, [PlayerActionType.SWAP_AND_DISCARD, PlayerActionType.DISCARD_DRAWN_CARD]);
      return !!context.players[event.playerId]?.pendingDrawnCard;
    },
    wasDrawnFromDeck: ({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      return context.players[event.playerId]?.pendingDrawnCard?.source === 'deck';
    },
    canDrawFromDiscard: ({ context }) => {
      if (context.discardPileIsSealed) return false;
      const topOfDiscard = context.discardPile.at(-1);
      return !!topOfDiscard && !specialRanks.has(topOfDiscard.rank);
    },
    matchWillEmptyHand: ({ context, event }) => {
        assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
        return context.players[event.playerId]!.hand.length === 1;
    },
    isAbilityCardOnTopOfAbilityStack: ({ context }) => context.abilityStack.length > 0,
    canAttemptMatch: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload: { handCardIndex } } = event;
      const { matchingOpportunity, players } = context;
      if (!matchingOpportunity) return false;
      const player = players[playerId];
      if (!player || !matchingOpportunity.remainingPlayerIDs.includes(playerId)) return false;
      const cardInHand = player.hand[handCardIndex];
      return !!cardInHand && cardInHand.rank === matchingOpportunity.cardToMatch.rank;
    },
    isValidAbilityAction: ({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      const currentAbility = context.abilityStack.at(-1);
    
      if (!currentAbility || currentAbility.playerId !== playerId || context.players[playerId]!.isLocked) {
        return false;
      }
    
      if (payload.action === 'skip') {
        return true;
      }
    
      if (payload.action === 'peek' && currentAbility.stage === 'peeking' && (currentAbility.type === 'peek' || currentAbility.type === 'king')) {
        // Check that no target is a locked opponent
        for (const target of payload.targets) {
          const targetPlayer = context.players[target.playerId];
          if (target.playerId !== playerId && targetPlayer?.isLocked) {
            return false; // Cannot peek at a locked opponent's cards
          }
        }
        return true;
      }
    
      if (payload.action === 'swap' && currentAbility.stage === 'swapping') {
        const { source, target } = payload;
        const sourcePlayer = context.players[source.playerId];
        const targetPlayer = context.players[target.playerId];
    
        // Check if the source card belongs to a locked opponent
        if (source.playerId !== playerId && sourcePlayer?.isLocked) {
          return false;
        }
        // Check if the target card belongs to a locked opponent
        if (target.playerId !== playerId && targetPlayer?.isLocked) {
          return false;
        }
        return true;
      }
    
      return false;
    },
    isCheckRoundOver: ({ context }) => {
      if (!context.checkDetails) return false;
      return context.checkDetails.finalTurnIndex >= context.checkDetails.finalTurnOrder.length;
    },
    isDeckEmpty: ({ context }) => context.deck.length === 0,
    isCurrentPlayer: ({ context, event }) => {
      assertEvent(event, 'PLAYER_DISCONNECTED');
      return context.currentPlayerId === event.playerId;
    },
    isInvalidMatchAttempt: ({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload: { handCardIndex } } = event;
      const { matchingOpportunity, players } = context;
    
      if (!matchingOpportunity) return false;
      const player = players[playerId];
      if (!player || !matchingOpportunity.remainingPlayerIDs.includes(playerId)) return false;
    
      const cardInHand = player.hand[handCardIndex];
      return !!cardInHand && cardInHand.rank !== matchingOpportunity.cardToMatch.rank;
    },
    isAbilityOwnerLocked: ({ context }) => {
      const currentAbility = context.abilityStack.at(-1);
      if (!currentAbility) return false;
      const owner = context.players[currentAbility.playerId];
      return !!owner?.isLocked;
    },
  },
  actions: {
    removePlayerAndHandleGM: assign(({ context, event }) => {
      assertEvent(event, [PlayerActionType.LEAVE_GAME, 'PLAYER_DISCONNECTED', 'LOBBY_DISCONNECT_TIMEOUT']);
      const { playerId } = event;
      if (!context.players[playerId]) {
        return {};
      }
  
      const playerName = getPlayerNameForLog(playerId, context);
      const { [playerId]: _, ...remainingPlayers } = context.players;
      const newTurnOrder = context.turnOrder.filter((id) => id !== playerId);
  
      let newGameMasterId = context.gameMasterId;
      // If the disconnected player was the Game Master, and there are other players left...
      if (playerId === context.gameMasterId && newTurnOrder.length > 0) {
        // ...make the next player in the list the new Game Master.
        newGameMasterId = newTurnOrder[0]!;
      } else if (newTurnOrder.length === 0) {
        // If no players are left, there's no Game Master.
        newGameMasterId = null;
      }
  
      return {
        players: remainingPlayers,
        turnOrder: newTurnOrder,
        gameMasterId: newGameMasterId,
        log: [
          ...context.log,
          createLogEntry(context, {
            message: `${playerName} has left the lobby.`,
            type: 'public',
            tags: ['system-message'],
          }),
        ],
      };
    }),
    addPlayer: assign(({ context, event }) => {
      assertEvent(event, 'PLAYER_JOIN_REQUEST');
      const { playerSetupData, playerId } = event;
      const isGameMaster = Object.keys(context.players).length === 0;
      const newPlayer: ServerPlayer = { id: playerId, name: playerSetupData.name, socketId: playerSetupData.socketId || '', hand: [], isReady: false, isDealer: isGameMaster, hasCalledCheck: false, isLocked: false, score: 0, isConnected: true, pendingDrawnCard: null, forfeited: false, status: PlayerStatus.WAITING };
      return { players: { ...context.players, [playerId]: newPlayer }, turnOrder: [...context.turnOrder, playerId], gameMasterId: isGameMaster ? playerId : context.gameMasterId, log: [...context.log, createLogEntry(context, { message: `${newPlayer.name} has joined the game.`, type: 'public', tags: ['system-message'] })] };
    }),
    emitPlayerJoinSuccess: emit(({ event }) => {
      assertEvent(event, 'PLAYER_JOIN_REQUEST');
      return { type: 'PLAYER_JOIN_SUCCESSFUL' as const, playerId: event.playerId };
    }),
    removePlayer: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.REMOVE_PLAYER);
      const { playerIdToRemove } = event.payload;
      if (!context.players[playerIdToRemove]) return {};
      const { [playerIdToRemove]: _, ...remainingPlayers } = context.players;
      return { players: remainingPlayers, turnOrder: context.turnOrder.filter(id => id !== playerIdToRemove), log: [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(playerIdToRemove, context)} was removed from the game.`, type: 'public', tags: ['system-message'] })] };
    }),
    performAbilityAction: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.USE_ABILITY);
      const { playerId, payload } = event;
      let newAbilityStack = [...context.abilityStack];
      const currentAbility = newAbilityStack.at(-1);
      if (!currentAbility || currentAbility.playerId !== playerId) return {};
      const newPlayers = JSON.parse(JSON.stringify(context.players)) as Record<PlayerId, ServerPlayer>;
      let newLog = [...context.log];
      if (payload.action === 'skip') {
        if (currentAbility.stage === 'peeking') {
          // Player chooses to forego the peek(s) but still retain the swap phase
          currentAbility.stage = 'swapping';
          delete currentAbility.remainingPeeks;
          newLog.push(createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} skipped their peeks.`, type: 'public', tags: ['player-action', 'ability'] }));
        } else {
          // Skipping during swap stage ends the ability entirely
          newAbilityStack.pop();
          newLog.push(createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} skipped their swap.`, type: 'public', tags: ['player-action', 'ability'] }));
        }
      } else if (payload.action === 'peek' && currentAbility.stage === 'peeking' && (currentAbility.type === 'peek' || currentAbility.type === 'king')) {
        if (currentAbility.remainingPeeks && currentAbility.remainingPeeks > 1) {
          currentAbility.remainingPeeks -= 1;
        } else {
          currentAbility.stage = 'swapping';
          delete currentAbility.remainingPeeks;
        }
        newLog = [...newLog, createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} used Peek.`, type: 'public', tags: ['player-action', 'ability']})];
      } else if (payload.action === 'swap' && currentAbility.stage === 'swapping') {
        const { source, target } = payload;
        const sourcePlayer = newPlayers[source.playerId]!; const targetPlayer = newPlayers[target.playerId]!;
        const sourceCard = sourcePlayer.hand[source.cardIndex]; const targetCard = targetPlayer.hand[target.cardIndex];
        sourcePlayer.hand[source.cardIndex] = targetCard; targetPlayer.hand[target.cardIndex] = sourceCard;
        newAbilityStack.pop();
        newLog = [...newLog, createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} used Swap.`, type: 'public', tags: ['player-action', 'ability']})];
      }
      return { players: newPlayers, abilityStack: newAbilityStack, log: newLog };
    }),
    updatePlayerLobbyReady: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DECLARE_LOBBY_READY);
      return context.players[event.playerId] ? { players: { ...context.players, [event.playerId]: { ...context.players[event.playerId]!, isReady: true } } } : {};
    }),
    dealCards: assign(({ context }) => {
      const shuffledDeck = shuffleDeck(createDeck());
      const newPlayers = JSON.parse(JSON.stringify(context.players)) as Record<PlayerId, ServerPlayer>;
      Object.values(newPlayers).forEach(p => { p.hand = []; p.isReady = false; });
      for (let i = 0; i < context.cardsPerPlayer; i++) { for (const playerId of context.turnOrder) { if(shuffledDeck.length) newPlayers[playerId]!.hand.push(shuffledDeck.pop()!); } }
      return { deck: shuffledDeck, players: newPlayers, discardPile: [], log: [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(context.gameMasterId!, context)} dealt the cards.`, type: 'public', tags: ['game-event'] })], gameStage: GameStage.DEALING };
    }),
    updatePlayerPeekReady: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DECLARE_READY_FOR_PEEK);
      return context.players[event.playerId] ? { players: { ...context.players, [event.playerId]: { ...context.players[event.playerId]!, isReady: true } } } : {};
    }),
    drawFromDeck: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DECK);
      const newDeck = [...context.deck];
      const drawnCard = newDeck.pop()!;
      // FIX: Explicitly type the pendingDrawnCard object
      const pendingDrawnCard: { card: Card; source: 'deck' | 'discard' } = { card: drawnCard, source: 'deck' };
      return {
        deck: newDeck,
        players: {
          ...context.players,
          [event.playerId]: { ...context.players[event.playerId]!, pendingDrawnCard }
        }
      };
    }),
    drawFromDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DRAW_FROM_DISCARD);
      const newDiscard = [...context.discardPile];
      const drawnCard = newDiscard.pop()!;
       // FIX: Explicitly type the pendingDrawnCard object
      const pendingDrawnCard: { card: Card; source: 'deck' | 'discard' } = { card: drawnCard, source: 'discard' };
      return {
        discardPile: newDiscard,
        players: {
          ...context.players,
          [event.playerId]: { ...context.players[event.playerId]!, pendingDrawnCard }
        }
      };
    }),
    swapAndDiscard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.SWAP_AND_DISCARD);
      const { playerId, payload: { handCardIndex } } = event;
      const player = context.players[playerId]!;
      const drawn = player.pendingDrawnCard!;
      const cardToDiscard = player.hand[handCardIndex]!;
      const newHand = [...player.hand]; newHand[handCardIndex] = drawn.card;
      return { players: { ...context.players, [playerId]: { ...player, hand: newHand, pendingDrawnCard: null } }, ...applyDiscardLogic(context, cardToDiscard, playerId) };
    }),
    discardDrawnCard: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.DISCARD_DRAWN_CARD);
      const player = context.players[event.playerId]!;
      const cardToDiscard = player.pendingDrawnCard!.card;
      return { players: { ...context.players, [event.playerId]: { ...player, pendingDrawnCard: null } }, ...applyDiscardLogic(context, cardToDiscard, event.playerId) };
    }),
    setNextPlayer: assign(({ context }) => {
      const { currentPlayerId, turnOrder } = context;
      if (!currentPlayerId) return {};
      let nextIndex = (turnOrder.indexOf(currentPlayerId) + 1) % turnOrder.length;
      let stop = turnOrder.length;
      while (stop > 0 && context.players[turnOrder[nextIndex]!]?.isLocked) { nextIndex = (nextIndex + 1) % turnOrder.length; stop--; }
      return { currentPlayerId: turnOrder[nextIndex]!, currentTurnSegment: TurnPhase.DRAW, };
    }),
    setupCheck: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.CALL_CHECK);
      const { playerId } = event;
      const callerIndex = context.turnOrder.indexOf(playerId);
      const finalTurnOrder = [...context.turnOrder.slice(callerIndex + 1), ...context.turnOrder.slice(0, callerIndex)].filter(id => !context.players[id]!.isLocked);
      return { players: { ...context.players, [playerId]: { ...context.players[playerId]!, isLocked: true, status: PlayerStatus.CALLED_CHECK }}, gameStage: GameStage.FINAL_TURNS, checkDetails: { callerId: playerId, finalTurnOrder, finalTurnIndex: 0 }};
    }),
    setNextPlayerInFinalTurns: assign(({ context }) => {
      if (!context.checkDetails) return {};
      let newIndex = context.checkDetails.finalTurnIndex;
      do { newIndex++; } while (newIndex < context.checkDetails.finalTurnOrder.length && context.players[context.checkDetails.finalTurnOrder[newIndex]!]?.isLocked);
      return { checkDetails: { ...context.checkDetails, finalTurnIndex: newIndex } };
    }),
    setCurrentPlayerInFinalTurns: assign(({ context }) => {
      const { checkDetails } = context;
      if (!checkDetails || checkDetails.finalTurnIndex >= checkDetails.finalTurnOrder.length) return { currentPlayerId: null };
      return { currentPlayerId: checkDetails.finalTurnOrder[checkDetails.finalTurnIndex]! };
    }),
    unsealDiscardPile: assign({ discardPileIsSealed: false }),
    setupMatchingOpportunity: assign(({ context }) => {
      if(!context.currentPlayerId) return {};
      const cardToMatch = context.discardPile.at(-1)!;
      return { matchingOpportunity: { cardToMatch, originalPlayerID: context.currentPlayerId, remainingPlayerIDs: context.turnOrder.filter(id => !context.players[id]!.isLocked) } };
    }),
    handleSuccessfulMatch: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId, payload: { handCardIndex } } = event;
      const cardFromHand = context.players[playerId]!.hand[handCardIndex]!;
      const cardOnDiscard = context.matchingOpportunity!.cardToMatch;
      const originalDiscarderId = context.matchingOpportunity!.originalPlayerID;
      let newPlayers = JSON.parse(JSON.stringify(context.players)) as Record<PlayerId, ServerPlayer>;
      newPlayers[playerId]!.hand.splice(handCardIndex, 1);
      let newCheckDetails = context.checkDetails; let gameStage = context.gameStage;
      if (newPlayers[playerId]!.hand.length === 0) {
          newPlayers[playerId]!.hasCalledCheck = true; newPlayers[playerId]!.isLocked = true;
          if (!context.checkDetails) {
              const callerIndex = context.turnOrder.indexOf(playerId);
              const finalTurnOrder = [...context.turnOrder.slice(callerIndex + 1), ...context.turnOrder.slice(0, callerIndex)].filter(id => !context.players[id]!.isLocked);
              newCheckDetails = { callerId: playerId, finalTurnOrder, finalTurnIndex: 0 }; gameStage = GameStage.FINAL_TURNS;
          }
      }
      let newAbilityStack = [...context.abilityStack];
      if (abilityRanks.has(cardFromHand.rank) && abilityRanks.has(cardOnDiscard.rank)) {
          const getAbilityType = (rank: CardRank): AbilityType => rank === CardRank.King ? 'king' : rank === CardRank.Queen ? 'peek' : 'swap';
          const getAbilityStage = (type: AbilityType) => type === 'king' || type === 'peek' ? 'peeking' : 'swapping';
          const originalDiscarderAbilityType = getAbilityType(cardOnDiscard.rank);
          const matcherAbilityType = getAbilityType(cardFromHand.rank);
          const ability1: ServerActiveAbility = { type: originalDiscarderAbilityType, stage: getAbilityStage(originalDiscarderAbilityType), playerId: originalDiscarderId, sourceCard: cardOnDiscard, source: 'stackSecondOfPair' };
          const ability2: ServerActiveAbility = { type: matcherAbilityType, stage: getAbilityStage(matcherAbilityType), playerId: playerId, sourceCard: cardFromHand, source: 'stack' };
          if (ability1.type === 'king') ability1.remainingPeeks = 2; else if (ability1.type === 'peek') ability1.remainingPeeks = 1;
          if (ability2.type === 'king') ability2.remainingPeeks = 2; else if (ability2.type === 'peek') ability2.remainingPeeks = 1;
          newAbilityStack.push(ability1);
          newAbilityStack.push(ability2);
      }
      return { players: newPlayers, discardPile: [...context.discardPile, cardFromHand], matchingOpportunity: null, discardPileIsSealed: true, abilityStack: newAbilityStack, log: [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} matched a ${cardFromHand.rank}.`, type: 'public', tags: ['player-action', 'game-event'] })], checkDetails: newCheckDetails, gameStage };
    }),
    handlePlayerPassedOnMatch: assign(({context, event}) => {
        assertEvent(event, PlayerActionType.PASS_ON_MATCH_ATTEMPT);
        if (!context.matchingOpportunity) return {};
        return { matchingOpportunity: { ...context.matchingOpportunity, remainingPlayerIDs: context.matchingOpportunity.remainingPlayerIDs.filter(id => id !== event.playerId) } };
    }),
    clearMatchingOpportunity: assign({ matchingOpportunity: null }),
    calculateScores: assign(({ context }) => {
      const newPlayers = JSON.parse(JSON.stringify(context.players)) as Record<PlayerId, ServerPlayer>;
      const playerScores: Record<PlayerId, number> = {};

      Object.values(newPlayers).forEach(p => {
        const score = p.hand.reduce((acc, card) => acc + cardScoreValues[card.rank], 0);
        playerScores[p.id] = score;
        p.score = score; // Update the player object directly
      });

      let minScore = Infinity;
      let loserId: PlayerId | null = null;
      let maxScore = -Infinity;

      for (const playerId in playerScores) {
        const score = playerScores[playerId]!;
        if (score < minScore) {
          minScore = score;
        }
        if (score > maxScore) {
          maxScore = score;
          loserId = playerId;
        }
      }

      const winnerIds = Object.keys(playerScores).filter(id => playerScores[id] === minScore);

      return {
        players: newPlayers, // Assign the updated players object
        winnerId: winnerIds[0] || null,
        gameover: { winnerIds, loserId, playerScores },
        gameStage: GameStage.GAMEOVER,
      };
    }),
    resetForNewRound: assign(({ context }) => {
      const newPlayers: Record<PlayerId, ServerPlayer> = {};
      const newDealerIndex = (context.turnOrder.indexOf(context.gameMasterId!) + 1) % context.turnOrder.length;
      const newDealerId = context.turnOrder[newDealerIndex]!;
      for (const p of Object.values(context.players)) { newPlayers[p.id] = { ...p, hand: [], isReady: false, isLocked: false, hasCalledCheck: false, pendingDrawnCard: null, isDealer: p.id === newDealerId, status: PlayerStatus.WAITING }; }
      return { players: newPlayers, deck: [], discardPile: [], abilityStack: [], checkDetails: null, gameover: null, currentPlayerId: newDealerId, lastRoundLoserId: context.gameover?.loserId || null, gameMasterId: newDealerId, gameStage: GameStage.WAITING_FOR_PLAYERS };
    }),
    setPlayerDisconnected: assign(({ context, event }) => {
      assertEvent(event, 'PLAYER_DISCONNECTED');
      return context.players[event.playerId] ? { players: { ...context.players, [event.playerId]: { ...context.players[event.playerId]!, isConnected: false } } } : {};
    }),
    addPlayerDisconnectedLog: assign({ log: ({ context, event }) => { assertEvent(event, 'PLAYER_DISCONNECTED'); return [...context.log, createLogEntry(context, { message: `${getPlayerNameForLog(event.playerId, context)} has disconnected.`, type: 'public', tags: ['system-message'] })] } }),
    markPlayerAsConnected: assign(({ context, event }) => {
      assertEvent(event, 'PLAYER_RECONNECTED');
      return context.players[event.playerId] ? { players: { ...context.players, [event.playerId]: { ...context.players[event.playerId]!, isConnected: true, socketId: event.newSocketId } } } : {};
    }),
    enterErrorState: assign((_, { params: { errorType, event } }: { params: { errorType: 'DECK_EMPTY' | 'NETWORK_ERROR', event: GameEvent }}) => {
        let message = ''; let affectedPlayerId: PlayerId | undefined;
        if (errorType === 'DECK_EMPTY') message = 'The deck is empty and cannot be drawn from.';
        else if (errorType === 'NETWORK_ERROR') {
            assertEvent(event, 'PLAYER_DISCONNECTED'); message = `Player ${event.playerId} has disconnected.`; affectedPlayerId = event.playerId;
        }
        return { errorState: { message, errorType, affectedPlayerId, retryCount: 0, recoveryState: null } };
    }),
    clearErrorState: assign({ errorState: null }),
    reshuffleDiscardIntoDeck: assign(({ context }) => {
      const newDiscard = [...context.discardPile]; const topCard = newDiscard.pop();
      return { deck: shuffleDeck(newDiscard), discardPile: topCard ? [topCard] : [], errorState: null };
    }),
    broadcastGameState: emit({ type: 'BROADCAST_GAME_STATE' }),
    setInitialPlayer: assign(({ context }) => ({ currentPlayerId: context.turnOrder[0]!, gameStage: GameStage.PLAYING, currentTurnSegment: TurnPhase.DRAW })),
    applyMatchPenalty: assign(({ context, event }) => {
      assertEvent(event, PlayerActionType.ATTEMPT_MATCH);
      const { playerId } = event;
  
      let tempDeck = [...context.deck];
      let tempDiscard = [...context.discardPile];
      let logMessageText = '';
  
      // If deck is empty, reshuffle discard pile into it
      if (tempDeck.length === 0) {
          const topCard = tempDiscard.pop();
          tempDeck = shuffleDeck(tempDiscard);
          tempDiscard = topCard ? [topCard] : [];
          logMessageText = `The discard pile was reshuffled. `;
      }
  
      if (tempDeck.length === 0) {
          // This case occurs if both deck and discard were empty.
          // We cannot apply a penalty, so we just log it.
          logMessageText += `${getPlayerNameForLog(playerId, context)} attempted an invalid match, but no penalty card could be drawn.`;
          return {
              log: [...context.log, createLogEntry(context, {
                  message: logMessageText,
                  type: 'public',
                  tags: ['game-event', 'error']
              })]
          };
      }
  
      const penaltyCard = tempDeck.pop()!;
      const newPlayers = JSON.parse(JSON.stringify(context.players));
      newPlayers[playerId]!.hand.push(penaltyCard);
  
      logMessageText += `${getPlayerNameForLog(playerId, context)} attempted an invalid match and received a penalty card.`;
  
      return {
          deck: tempDeck,
          discardPile: tempDiscard,
          players: newPlayers,
          log: [...context.log, createLogEntry(context, {
              message: logMessageText,
              type: 'public',
              tags: ['player-action', 'game-event']
          })],
      };
    }),
    handleFailedRecovery: assign(({ context }) => {
      const affectedPlayerId = context.errorState?.affectedPlayerId;
      if (!affectedPlayerId || !context.players[affectedPlayerId]) {
          return { errorState: null };
      }

      const newPlayers = { ...context.players } as Record<PlayerId, ServerPlayer>;
      newPlayers[affectedPlayerId] = { ...newPlayers[affectedPlayerId]!, forfeited: true, isConnected: false, isLocked: true };

      const newTurnOrder = context.turnOrder.filter(id => id !== affectedPlayerId);
      let newCurrentPlayerId = context.currentPlayerId;

      if (context.currentPlayerId === affectedPlayerId) {
          const currentIndex = context.turnOrder.indexOf(context.currentPlayerId!);
          const nextIndex = (currentIndex + 1) % context.turnOrder.length;
          newCurrentPlayerId = context.turnOrder[nextIndex] === affectedPlayerId ? null : context.turnOrder[nextIndex]!;
      }

      if (newTurnOrder.length <= 1) {
          const winnerId = newTurnOrder[0] ?? null;
          return {
              players: newPlayers,
              turnOrder: newTurnOrder,
              gameStage: GameStage.GAMEOVER,
              gameover: { winnerIds: winnerId ? [winnerId] : [], loserId: affectedPlayerId, playerScores: {} },
              errorState: null,
          };
      }

      return {
          players: newPlayers,
          turnOrder: newTurnOrder,
          currentPlayerId: newCurrentPlayerId,
          errorState: null,
      };
    }),
    fizzleTopAbility: assign({
      abilityStack: ({ context }) => context.abilityStack.slice(0, -1),
      log: ({ context }) => {
        const fizzledAbility = context.abilityStack.at(-1);
        if (!fizzledAbility) return context.log;
        const message = `${getPlayerNameForLog(fizzledAbility.playerId, context)}'s ability fizzled because they are locked.`;
        return [...context.log, createLogEntry(context, { message, type: 'public', tags: ['game-event', 'ability'] })];
      }
    }),
    // === Logging actions for observability ===
    log_ENTER_WAITING: () => logger.info({ machine: 'game', state: 'WAITING_FOR_PLAYERS' }, 'Entered WAITING_FOR_PLAYERS state'),
    log_ENTER_DEALING: () => logger.info({ machine: 'game', state: 'DEALING' }, 'Entered DEALING state'),
    log_ENTER_INITIAL_PEEK: () => logger.info({ machine: 'game', state: 'INITIAL_PEEK' }, 'Entered INITIAL_PEEK state'),
    log_ENTER_PLAYING: () => logger.info({ machine: 'game', state: 'PLAYING' }, 'Entered PLAYING state'),
    log_ENTER_FINAL_TURNS: () => logger.info({ machine: 'game', state: 'FINAL_TURNS' }, 'Entered FINAL_TURNS state'),
    log_ENTER_SCORING: () => logger.info({ machine: 'game', state: 'SCORING' }, 'Entered SCORING state'),
    log_ENTER_GAMEOVER: () => logger.info({ machine: 'game', state: 'GAMEOVER' }, 'Entered GAMEOVER state'),
    log_ENTER_ERROR: () => logger.info({ machine: 'game', state: 'error' }, 'Entered ERROR state'),
    // Turn-phase logging
    log_ENTER_TURN_DRAW: () => logger.info({ machine: 'game', substate: 'DRAW' }, 'Turn phase: DRAW'),
    log_ENTER_TURN_DISCARD: () => logger.info({ machine: 'game', substate: 'DISCARD' }, 'Turn phase: DISCARD'),
    log_ENTER_TURN_MATCHING: () => logger.info({ machine: 'game', substate: 'MATCHING' }, 'Turn phase: MATCHING'),
    log_ENTER_TURN_ABILITY: () => logger.info({ machine: 'game', substate: 'ABILITY' }, 'Turn phase: ABILITY'),
  },
  actors: {
    peekTimer: fromPromise(() => new Promise(resolve => setTimeout(resolve, PEEK_TOTAL_DURATION_MS))),
    matchingTimerActor: fromPromise(() => new Promise(resolve => setTimeout(resolve, MATCHING_STAGE_DURATION_MS))),
    reconnectTimer: fromPromise(() => new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MS))),
  },
}).createMachine({
  id: 'game',
  context: ({ input }) => ({
    gameId: input.gameId,
    maxPlayers: input.maxPlayers ?? MAX_PLAYERS,
    cardsPerPlayer: input.cardsPerPlayer ?? CARDS_PER_PLAYER,
    deck: [],
    players: {},
    discardPile: [],
    turnOrder: [],
    gameMasterId: null,
    currentPlayerId: null,
    currentTurnSegment: null,
    gameStage: GameStage.WAITING_FOR_PLAYERS,
    matchingOpportunity: null,
    abilityStack: [],
    checkDetails: null,
    winnerId: null,
    gameover: null,
    lastRoundLoserId: null,
    log: [],
    chat: [],
    discardPileIsSealed: false,
    errorState: null,
  }),
  initial: GameStage.WAITING_FOR_PLAYERS,
  on: {
    [PlayerActionType.SEND_CHAT_MESSAGE]: {
      actions: [
        // 1. Add the message to the context
        assign({
          chat: ({ context, event }) => {
            assertEvent(event, PlayerActionType.SEND_CHAT_MESSAGE);
            const newChatMessage: ChatMessage = {
              id: `chat_${Date.now()}`,
              timestamp: new Date().toISOString(),
              ...event.payload,
            };
            return [...context.chat, newChatMessage];
          },
        }),
        // 2. Emit an event telling the server to broadcast ONLY the chat message
        emit(({ event }) => {
          assertEvent(event, PlayerActionType.SEND_CHAT_MESSAGE);
          const newChatMessage: ChatMessage = {
            id: `chat_${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...event.payload,
          };
          return { type: 'BROADCAST_CHAT_MESSAGE', chatMessage: newChatMessage };
        }),
      ],
    },
  },
  states: {
    [GameStage.WAITING_FOR_PLAYERS]: {
      entry: 'log_ENTER_WAITING',
      on: {
        PLAYER_JOIN_REQUEST: { guard: 'canJoinGame', actions: ['addPlayer', 'emitPlayerJoinSuccess', 'broadcastGameState'] as const },
        [PlayerActionType.DECLARE_LOBBY_READY]: { actions: ['updatePlayerLobbyReady', 'broadcastGameState'] as const },
        [PlayerActionType.START_GAME]: { target: GameStage.DEALING, guard: and(['isGameMaster', 'areAllPlayersReady']) },
        [PlayerActionType.REMOVE_PLAYER]: { guard: 'isGameMaster', actions: ['removePlayer', 'broadcastGameState'] as const },
        [PlayerActionType.LEAVE_GAME]: {
          actions: ['removePlayerAndHandleGM', 'broadcastGameState']
        },
        PLAYER_DISCONNECTED: {
          actions: [
            'setPlayerDisconnected',
            'addPlayerDisconnectedLog',
            'broadcastGameState',
            raise(({ event }) => ({ type: 'LOBBY_DISCONNECT_TIMEOUT', playerId: event.playerId }), { delay: LOBBY_DISCONNECT_TIMEOUT_MS })
          ]
        },
        PLAYER_RECONNECTED: { actions: ['markPlayerAsConnected', 'broadcastGameState'] },
        LOBBY_DISCONNECT_TIMEOUT: {
          guard: ({ context, event }) => !context.players[event.playerId]?.isConnected,
          actions: ['removePlayerAndHandleGM', 'broadcastGameState']
        },
      },
    },
    [GameStage.DEALING]: {
      entry: ['log_ENTER_DEALING', 'dealCards', 'broadcastGameState'] as const,
      after: { 100: GameStage.INITIAL_PEEK },
      on: {
        [PlayerActionType.LEAVE_GAME]: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
        PLAYER_DISCONNECTED: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
      }
    },
    [GameStage.INITIAL_PEEK]: {
      entry: ['log_ENTER_INITIAL_PEEK', 'broadcastGameState'],
      initial: 'waitingForReady',
      on: {
        [PlayerActionType.LEAVE_GAME]: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
        PLAYER_DISCONNECTED: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
      },
      states: {
        waitingForReady: {
          on: {
            [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
              actions: ['updatePlayerPeekReady', 'broadcastGameState'],
            },
          },
          always: {
            target: 'peeking',
            guard: 'allPlayersReadyForPeek',
          },
        },
        peeking: {
          entry: enqueueActions(({ context, enqueue }) => {
            context.turnOrder.forEach(playerId => {
                const playerHand = context.players[playerId]!.hand;
                const peekableCards = playerHand.slice(-2);
                enqueue(emit({
                    type: 'SEND_EVENT_TO_PLAYER',
                    payload: {
                        playerId,
                        eventName: SocketEventName.INITIAL_PEEK_INFO,
                        eventData: { hand: peekableCards }
                    }
                }));
            });
            enqueue('broadcastGameState' as const);
          }),
          invoke: { 
            src: 'peekTimer', 
            onDone: { 
              target: `#game.${GameStage.PLAYING}`, 
              actions: 'setInitialPlayer' 
            }
          },
        }
      }
    },
    [GameStage.PLAYING]: {
      entry: 'log_ENTER_PLAYING',
      initial: 'turn',
      on: {
        [PlayerActionType.LEAVE_GAME]: { target: '.error', guard: 'isCurrentPlayer' as const, actions: ({ event }) => ({ type: 'enterErrorState', params: { errorType: 'NETWORK_ERROR', event }}) },
        PLAYER_DISCONNECTED: { target: '.error', guard: 'isCurrentPlayer' as const, actions: ({ event }) => ({ type: 'enterErrorState', params: { errorType: 'NETWORK_ERROR', event }}) },
        [PlayerActionType.CALL_CHECK]: { target: GameStage.FINAL_TURNS, guard: 'isPlayerTurn' as const, actions: ['setupCheck', 'broadcastGameState'] as const },
      },
      states: {
        turn: {
          initial: TurnPhase.DRAW,
          states: {
            [TurnPhase.DRAW]: {
              entry: [
                'log_ENTER_TURN_DRAW',
                assign({ currentTurnSegment: TurnPhase.DRAW }),
                'unsealDiscardPile',
                'broadcastGameState',
              ],
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: {
                  target: 'DISCARD',
                  guard: and(['isPlayerTurn', not('isDeckEmpty')]),
                  actions: 'drawFromDeck',
                },
                [PlayerActionType.DRAW_FROM_DISCARD]: {
                  target: 'DISCARD',
                  guard: and(['isPlayerTurn', 'canDrawFromDiscard']),
                  actions: 'drawFromDiscard',
                },
              },
              always: {
                target: `#game.error`,
                guard: 'isDeckEmpty',
                actions: ({ event }: { event: GameEvent }) => ({ type: 'enterErrorState', params: { errorType: 'DECK_EMPTY', event }})
              },
            },
            [TurnPhase.DISCARD]: {
              entry: ['log_ENTER_TURN_DISCARD', assign({ currentTurnSegment: TurnPhase.DISCARD }), 'broadcastGameState'],
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'postDiscard' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'postDiscard' },
              },
            },
            discardAfterDiscardDraw: {
              on: { [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'postDiscard' } },
            },
            postDiscard: {
              entry: 'broadcastGameState',
              always: { target: 'matching' },
            },
            ability: {
              entry: 'log_ENTER_TURN_ABILITY',
              always: [
                { guard: 'isAbilityOwnerLocked' as const, actions: ['fizzleTopAbility', 'broadcastGameState'] as const },
                { target: 'endOfTurn', guard: not('isAbilityCardOnTopOfAbilityStack') },
              ] as const,
              on: { [PlayerActionType.USE_ABILITY]: { guard: 'isValidAbilityAction' as const, actions: ['performAbilityAction', 'broadcastGameState'] as const } },
            },
            matching: {
              entry: ['log_ENTER_TURN_MATCHING', 'setupMatchingOpportunity', 'broadcastGameState'] as const,
              invoke: { src: 'matchingTimerActor', onDone: { actions: ['clearMatchingOpportunity', 'broadcastGameState'], target: 'ability' } },
              on: {
                [PlayerActionType.ATTEMPT_MATCH]: [
                  { guard: 'canAttemptMatch' as const, actions: 'handleSuccessfulMatch', target: 'postMatch' },
                  { actions: ['applyMatchPenalty', 'broadcastGameState'] as const },
                ],
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: { actions: 'handlePlayerPassedOnMatch' },
              },
              always: [
                { guard: ({ context }: { context: GameContext }) => (!context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0) && context.abilityStack.length > 0, target: 'ability', actions: ['clearMatchingOpportunity', 'broadcastGameState'] },
                { guard: ({ context }: { context: GameContext }) => (!context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0) && context.abilityStack.length === 0, target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] },
              ],
            },
            postMatch: {
              always: [
                { target: 'ability', guard: 'isAbilityCardOnTopOfAbilityStack' as const },
                { target: 'endOfTurn' },
              ] as const,
            },
            endOfTurn: { type: 'final' },
          },
          onDone: {
            target: 'turn',
            actions: ['setNextPlayer'] as const,
          },
        },
        error: { id: 'playing.error', /* ...error state logic... */ },
      },
    },
    [GameStage.FINAL_TURNS]: {
      id: GameStage.FINAL_TURNS,
      entry: ['log_ENTER_FINAL_TURNS', 'setCurrentPlayerInFinalTurns', 'broadcastGameState'] as const,
      always: { target: GameStage.SCORING, guard: 'isCheckRoundOver' as const },
      on: {
        [PlayerActionType.LEAVE_GAME]: { target: '#game.error', guard: 'isCurrentPlayer' as const, actions: ({ event }) => ({ type: 'enterErrorState', params: { errorType: 'NETWORK_ERROR', event }}) },
        PLAYER_DISCONNECTED: { target: '#game.error', guard: 'isCurrentPlayer' as const, actions: ({ event }) => ({ type: 'enterErrorState', params: { errorType: 'NETWORK_ERROR', event }}) },
      },
      initial: 'turn',
      states: {
        turn: {
          initial: TurnPhase.DRAW,
          states: {
            [TurnPhase.DRAW]: {
              entry: [ 'log_ENTER_TURN_DRAW', assign({ currentTurnSegment: TurnPhase.DRAW }), 'unsealDiscardPile', 'broadcastGameState'] as const,
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: { target: TurnPhase.DISCARD, guard: not('isDeckEmpty'), actions: 'drawFromDeck' },
                [PlayerActionType.DRAW_FROM_DISCARD]: { target: 'discardAfterDiscardDraw', guard: 'canDrawFromDiscard' as const, actions: 'drawFromDiscard' },
              },
              always: { target: `#game.error`, guard: 'isDeckEmpty' as const, actions: ({ event }: { event: GameEvent }) => ({ type: 'enterErrorState', params: { errorType: 'DECK_EMPTY', event }}) },
            },
            [TurnPhase.DISCARD]: {
              entry: ['log_ENTER_TURN_DISCARD', assign({ currentTurnSegment: TurnPhase.DISCARD }), 'broadcastGameState'],
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: 'hasDrawnCard' as const, actions: 'swapAndDiscard', target: 'postDiscard' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'postDiscard' },
              },
            },
            discardAfterDiscardDraw: {
              on: { [PlayerActionType.SWAP_AND_DISCARD]: { guard: 'hasDrawnCard' as const, actions: 'swapAndDiscard', target: 'postDiscard' } },
            },
            postDiscard: {
              entry: 'broadcastGameState' as const,
              always: [{ guard: 'isAbilityCardOnTopOfAbilityStack' as const, target: 'ability' }, { target: 'matching' }] as const,
            },
            ability: {
              entry: 'log_ENTER_TURN_ABILITY',
              always: [
                { guard: 'isAbilityOwnerLocked' as const, actions: ['fizzleTopAbility', 'broadcastGameState'] as const },
                { target: 'endOfTurn', guard: not('isAbilityCardOnTopOfAbilityStack') },
              ] as const,
              on: { [PlayerActionType.USE_ABILITY]: { guard: 'isValidAbilityAction' as const, actions: ['performAbilityAction', 'broadcastGameState'] as const } },
            },
            matching: {
              entry: ['log_ENTER_TURN_MATCHING', 'setupMatchingOpportunity', 'broadcastGameState'] as const,
              invoke: { src: 'matchingTimerActor', onDone: { actions: ['clearMatchingOpportunity', 'broadcastGameState'], target: 'ability' } },
              on: {
                [PlayerActionType.ATTEMPT_MATCH]: [
                  { guard: 'canAttemptMatch' as const, actions: 'handleSuccessfulMatch', target: 'postMatch' },
                  { actions: ['applyMatchPenalty', 'broadcastGameState'] as const },
                ],
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: { actions: 'handlePlayerPassedOnMatch' },
              },
              always: [
                { guard: ({ context }: { context: GameContext }) => (!context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0) && context.abilityStack.length > 0, target: 'ability', actions: ['clearMatchingOpportunity', 'broadcastGameState'] },
                { guard: ({ context }: { context: GameContext }) => (!context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0) && context.abilityStack.length === 0, target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] },
              ],
            },
            postMatch: {
              always: [
                { target: 'ability', guard: 'isAbilityCardOnTopOfAbilityStack' as const },
                { target: 'endOfTurn' },
              ] as const,
            },
            endOfTurn: { type: 'final' },
          },
          onDone: {
            target: 'turn',
            actions: ['setNextPlayerInFinalTurns', 'setCurrentPlayerInFinalTurns', 'broadcastGameState'] as const,
          },
        },
      },
    },
    [GameStage.SCORING]: {
        entry: ['log_ENTER_SCORING', 'calculateScores', 'broadcastGameState'] as const,
        after: { 5000: GameStage.GAMEOVER }
    },
    [GameStage.GAMEOVER]: {
        entry: 'log_ENTER_GAMEOVER',
        on: { 
          [PlayerActionType.PLAY_AGAIN]: { target: GameStage.DEALING, actions: ['resetForNewRound', 'dealCards', 'broadcastGameState'] as const },
          [PlayerActionType.LEAVE_GAME]: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
          PLAYER_DISCONNECTED: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
        },
    },
    error: {
      id: 'game.error',
      entry: 'log_ENTER_ERROR',
      initial: 'recovering',
      states: {
        recovering: {
          always: { guard: ({context}) => context.errorState?.errorType === 'DECK_EMPTY', actions: ['reshuffleDiscardIntoDeck', 'broadcastGameState'] as const, target: '#game' },
          invoke: { src: 'reconnectTimer', onDone: 'failedRecovery' },
          on: {
            PLAYER_RECONNECTED: { target: '#game', actions: ['markPlayerAsConnected', 'clearErrorState', 'broadcastGameState'] as const,
              guard: ({ context, event }) => context.errorState?.affectedPlayerId === event.playerId,
            },
          },
        },
        failedRecovery: { entry: ['handleFailedRecovery', 'broadcastGameState'] as const },
      },
    },
  },
});