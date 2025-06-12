import { setup, assign, fromPromise, assertEvent, emit, and, not, enqueueActions } from 'xstate';
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

export interface ServerActiveAbility extends Omit<ActiveAbility, 'stage'> {
  stage: 'peeking' | 'swapping' | 'done';
  source: 'discard' | 'stack' | 'stackSecondOfPair';
}
export interface ServerPlayer { id: PlayerId; name: string; socketId: string; hand: Card[]; isReady: boolean; isDealer: boolean; hasCalledCheck: boolean; isLocked: boolean; score: number; isConnected: boolean; status: PlayerStatus; pendingDrawnCard: { card: Card; source: 'deck' | 'discard'; } | null; forfeited: boolean; }
export interface GameContext { gameId: string; deck: Card[]; players: Record<PlayerId, ServerPlayer>; discardPile: Card[]; turnOrder: PlayerId[]; gameMasterId: PlayerId | null; currentPlayerId: PlayerId | null; currentTurnSegment: TurnPhase | null; gameStage: GameStage; matchingOpportunity: { cardToMatch: Card; originalPlayerID: PlayerId; remainingPlayerIDs: PlayerId[]; } | null; abilityStack: ServerActiveAbility[]; checkDetails: { callerId: PlayerId; finalTurnOrder: PlayerId[]; finalTurnIndex: number; } | null; gameover: { winnerId: PlayerId | null; loserId: PlayerId | null; playerScores: Record<PlayerId, number>; } | null; lastRoundLoserId: PlayerId | null; log: RichGameLogMessage[]; chat: ChatMessage[]; discardPileIsSealed: boolean; errorState: { message: string; retryCount: number; errorType: 'DECK_EMPTY' | 'NETWORK_ERROR' | 'PLAYER_ERROR' | 'GENERAL_ERROR' | null; affectedPlayerId?: PlayerId; recoveryState?: any; } | null; maxPlayers: number; cardsPerPlayer: number; }
type GameInput = { gameId: string; maxPlayers?: number; cardsPerPlayer?: number; };
type PlayerActionEvents = | { type: PlayerActionType.START_GAME; playerId: PlayerId; } | { type: PlayerActionType.DECLARE_LOBBY_READY; playerId: PlayerId; } | { type: PlayerActionType.DRAW_FROM_DECK; playerId: PlayerId } | { type: PlayerActionType.DRAW_FROM_DISCARD; playerId: PlayerId } | { type: PlayerActionType.SWAP_AND_DISCARD; playerId: PlayerId; payload: { handCardIndex: number } } | { type: PlayerActionType.DISCARD_DRAWN_CARD; playerId: PlayerId } | { type: PlayerActionType.ATTEMPT_MATCH; playerId: PlayerId; payload: { handCardIndex: number } } | { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT; playerId: PlayerId } | { type: PlayerActionType.CALL_CHECK; playerId: PlayerId } | { type: PlayerActionType.DECLARE_READY_FOR_PEEK; playerId: PlayerId } | { type: PlayerActionType.PLAY_AGAIN; playerId: PlayerId } | { type: PlayerActionType.USE_ABILITY; playerId: PlayerId; payload: AbilityActionPayload } | { type: PlayerActionType.SEND_CHAT_MESSAGE, payload: Omit<ChatMessage, 'id' | 'timestamp'> } | { type: PlayerActionType.LEAVE_GAME; playerId: PlayerId } | { type: PlayerActionType.REMOVE_PLAYER; playerId: PlayerId; payload: { playerIdToRemove: string } };
type GameEvent = | { type: 'PLAYER_JOIN_REQUEST'; playerSetupData: InitialPlayerSetupData; playerId: PlayerId } | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string } | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId } | { type: 'CLIENT_ERROR_REPORT'; playerId: PlayerId; errorType: string; message: string; context?: any } | PlayerActionEvents | { type: 'TIMER.PEEK_EXPIRED' } | { type: 'TIMER.MATCHING_EXPIRED' };
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
      newAbilityStack.push({ type, stage: type === 'king' || type === 'peek' ? 'peeking' : 'swapping', playerId, sourceCard: cardToDiscard, source: 'discard' });
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
      if (!currentAbility || currentAbility.playerId !== playerId || context.players[playerId]!.isLocked) return false;
      if (payload.action === 'skip') return true;
      if (payload.action === 'peek' && (currentAbility.type === 'peek' || (currentAbility.type === 'king' && currentAbility.stage === 'peeking'))) return true;
      if (payload.action === 'swap' && (currentAbility.type === 'swap' || (currentAbility.type === 'king' && currentAbility.stage === 'swapping'))) return true;
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
  },
  actions: {
    addPlayer: assign(({ context, event }) => {
      assertEvent(event, 'PLAYER_JOIN_REQUEST');
      const { playerSetupData, playerId } = event;
      const isGameMaster = Object.keys(context.players).length === 0;
      const newPlayer: ServerPlayer = { id: playerId, name: playerSetupData.name, socketId: playerSetupData.socketId || '', hand: [], isReady: false, isDealer: isGameMaster, hasCalledCheck: false, isLocked: false, score: 0, isConnected: true, pendingDrawnCard: null, forfeited: false, status: PlayerStatus.WAITING };
      return { players: { ...context.players, [playerId]: newPlayer }, turnOrder: [...context.turnOrder, playerId], gameMasterId: isGameMaster ? playerId : context.gameMasterId, log: [...context.log, createLogEntry(context, { message: `${newPlayer.name} has joined the game.`, type: 'public', tags: ['system-message'] })] };
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
        if (currentAbility.type === 'king' && currentAbility.stage === 'peeking') { currentAbility.stage = 'swapping'; } else { newAbilityStack.pop(); }
        newLog.push(createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} skipped their ability.`, type: 'public', tags: ['player-action', 'ability']}));
      } else if (payload.action === 'peek' && (currentAbility.type === 'peek' || (currentAbility.type === 'king' && currentAbility.stage === 'peeking'))) {
        if (currentAbility.type === 'king') { currentAbility.stage = 'swapping'; } else { newAbilityStack.pop(); }
        newLog = [...newLog, createLogEntry(context, { message: `${getPlayerNameForLog(playerId, context)} used Peek.`, type: 'public', tags: ['player-action', 'ability']})];
      } else if (payload.action === 'swap' && (currentAbility.type === 'swap' || (currentAbility.type === 'king' && currentAbility.stage === 'swapping'))) {
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
      return { currentPlayerId: turnOrder[nextIndex]! };
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
          newAbilityStack.push({ type: originalDiscarderAbilityType, stage: getAbilityStage(originalDiscarderAbilityType), playerId: originalDiscarderId, sourceCard: cardOnDiscard, source: 'stackSecondOfPair' });
          newAbilityStack.push({ type: matcherAbilityType, stage: getAbilityStage(matcherAbilityType), playerId: playerId, sourceCard: cardFromHand, source: 'stack' });
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
      const playerScores: Record<PlayerId, number> = {};
      Object.values(context.players).forEach(p => { playerScores[p.id] = p.hand.reduce((acc, card) => acc + cardScoreValues[card.rank], 0); });
      let winnerId: PlayerId | null = null; let loserId: PlayerId | null = null;
      let minScore = Infinity; let maxScore = -Infinity;
      for (const playerId in playerScores) {
        if (playerScores[playerId]! < minScore) { minScore = playerScores[playerId]!; winnerId = playerId; }
        if (playerScores[playerId]! > maxScore) { maxScore = playerScores[playerId]!; loserId = playerId; }
      }
      return { gameover: { winnerId, loserId, playerScores }, gameStage: GameStage.GAMEOVER };
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
    handleFailedRecovery: assign(({ context }) => {
      const affectedPlayerId = context.errorState?.affectedPlayerId;
      if (!affectedPlayerId || !context.players[affectedPlayerId]) {
          return { errorState: null }; // Should not happen, but clear error state
      }
  
      const newPlayers = { ...context.players };
      newPlayers[affectedPlayerId] = { ...newPlayers[affectedPlayerId]!, forfeited: true, isConnected: false, isLocked: true };
  
      const newTurnOrder = context.turnOrder.filter(id => id !== affectedPlayerId);
      
      let newCurrentPlayerId = context.currentPlayerId;
      // If the disconnected player was the current player, advance the turn.
      if (context.currentPlayerId === affectedPlayerId) {
          const currentIndex = context.turnOrder.indexOf(context.currentPlayerId!);
          const nextIndex = (currentIndex + 1) % context.turnOrder.length;
          // This check is simple; a more robust one would loop, but for this case it's fine.
          newCurrentPlayerId = context.turnOrder[nextIndex] === affectedPlayerId ? null : context.turnOrder[nextIndex]!;
      }
      
      // If only one player is left, they are the winner.
      if (newTurnOrder.length <= 1) {
          const winnerId = newTurnOrder[0] ?? null;
          return {
              players: newPlayers,
              turnOrder: newTurnOrder,
              gameStage: GameStage.GAMEOVER,
              gameover: { winnerId, loserId: affectedPlayerId, playerScores: {} },
              errorState: null,
          }
      }
  
      return {
          players: newPlayers,
          turnOrder: newTurnOrder,
          currentPlayerId: newCurrentPlayerId,
          errorState: null, // Clear the error and continue the game
      };
    }),
    broadcastGameState: emit({ type: 'BROADCAST_GAME_STATE' }),
    setInitialPlayer: assign(({ context }) => ({ currentPlayerId: context.turnOrder[0]!, gameStage: GameStage.PLAYING })),
  },
  actors: {
    peekTimer: fromPromise(() => new Promise(resolve => setTimeout(resolve, PEEK_TOTAL_DURATION_MS))),
    matchingTimerActor: fromPromise(() => new Promise(resolve => setTimeout(resolve, MATCHING_STAGE_DURATION_MS))),
    reconnectTimer: fromPromise(() => new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MS))),
  },
}).createMachine({
  id: 'game',
  context: ({ input }) => ({
    gameId: input.gameId, maxPlayers: input.maxPlayers ?? MAX_PLAYERS, cardsPerPlayer: input.cardsPerPlayer ?? CARDS_PER_PLAYER, deck: [], players: {}, discardPile: [], turnOrder: [], gameMasterId: null, currentPlayerId: null,
    currentTurnSegment: null, gameStage: GameStage.WAITING_FOR_PLAYERS, matchingOpportunity: null, abilityStack: [],
    checkDetails: null, gameover: null, lastRoundLoserId: null, log: [], chat: [], discardPileIsSealed: false, errorState: null,
  }),
  initial: GameStage.WAITING_FOR_PLAYERS,
  on: {
    [PlayerActionType.LEAVE_GAME]: { actions: ['setPlayerDisconnected', 'addPlayerDisconnectedLog', 'broadcastGameState'] as const },
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
      on: {
        PLAYER_JOIN_REQUEST: { guard: 'canJoinGame', actions: 'addPlayer' },
        [PlayerActionType.DECLARE_LOBBY_READY]: { actions: ['updatePlayerLobbyReady', 'broadcastGameState'] as const },
        [PlayerActionType.START_GAME]: { target: GameStage.DEALING, guard: and(['isGameMaster', 'areAllPlayersReady']) },
        [PlayerActionType.REMOVE_PLAYER]: { guard: 'isGameMaster', actions: ['removePlayer', 'broadcastGameState'] as const },
      },
    },
    [GameStage.DEALING]: {
      entry: ['dealCards', 'broadcastGameState'] as const,
      after: { 100: GameStage.INITIAL_PEEK },
    },
    [GameStage.INITIAL_PEEK]: {
      entry: enqueueActions(({ context, enqueue }) => {
          context.turnOrder.forEach(playerId => enqueue(emit({ type: 'SEND_EVENT_TO_PLAYER', payload: { playerId, eventName: SocketEventName.INITIAL_PEEK_INFO, eventData: { hand: context.players[playerId]!.hand } } })));
          enqueue('broadcastGameState' as const);
      }),
      invoke: { src: 'peekTimer', onDone: { target: GameStage.PLAYING, actions: 'setInitialPlayer' as const } },
      on: {
        [PlayerActionType.DECLARE_READY_FOR_PEEK]: { actions: ['updatePlayerPeekReady', 'broadcastGameState'] as const },
        'TIMER.PEEK_EXPIRED': { target: GameStage.PLAYING, actions: 'setInitialPlayer' as const },
      },
      always: { target: GameStage.PLAYING, guard: 'allPlayersReadyForPeek' as const, actions: 'setInitialPlayer' as const }
    },
    [GameStage.PLAYING]: {
      initial: 'turn',
      on: {
        PLAYER_DISCONNECTED: { target: '.error', guard: 'isCurrentPlayer' as const, actions: ({ event }) => ({ type: 'enterErrorState', params: { errorType: 'NETWORK_ERROR', event }}) },
        [PlayerActionType.CALL_CHECK]: { target: GameStage.FINAL_TURNS, guard: 'isPlayerTurn' as const, actions: ['setupCheck', 'broadcastGameState'] as const },
      },
      states: {
        turn: {
            initial: TurnPhase.DRAW,
            entry: ['unsealDiscardPile', 'broadcastGameState'] as const,
            on: {
                [PlayerActionType.DRAW_FROM_DECK]: { target: 'discard', guard: and(['isPlayerTurn', not('isDeckEmpty')]), actions: ['drawFromDeck', 'broadcastGameState'] as const },
                [PlayerActionType.DRAW_FROM_DISCARD]: { target: 'discardAfterDiscardDraw', guard: and(['isPlayerTurn', 'canDrawFromDiscard']), actions: ['drawFromDiscard', 'broadcastGameState'] as const },
            },
            always: { target: `#game.error`, guard: 'isDeckEmpty' as const, actions: ({ event }: { event: GameEvent }) => ({ type: 'enterErrorState', params: { errorType: 'DECK_EMPTY', event }}) }
        },
        discard: {
            on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'postDiscard' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'postDiscard' },
            },
        },
        discardAfterDiscardDraw: {
            on: { [PlayerActionType.SWAP_AND_DISCARD]: { guard: and(['isPlayerTurn', 'hasDrawnCard']), actions: 'swapAndDiscard', target: 'postDiscard' }, },
        },
        postDiscard: {
            entry: 'broadcastGameState' as const,
            always: [{ guard: 'isAbilityCardOnTopOfAbilityStack' as const, target: 'ability' }, { target: 'matching' }] as const
        },
        ability: {
            on: { [PlayerActionType.USE_ABILITY]: { guard: 'isValidAbilityAction' as const, actions: ['performAbilityAction', 'broadcastGameState'] as const } },
            always: { target: 'endOfTurn', guard: not('isAbilityCardOnTopOfAbilityStack') }
        },
        matching: {
            entry: ['setupMatchingOpportunity', 'broadcastGameState'] as const,
            invoke: { src: 'matchingTimerActor', onDone: { target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] as const } },
            on: {
                [PlayerActionType.ATTEMPT_MATCH]: { guard: 'canAttemptMatch' as const, actions: 'handleSuccessfulMatch', target: 'postMatch' },
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: { actions: 'handlePlayerPassedOnMatch' }
            },
            always: {
                guard: ({ context }: { context: GameContext }) => !context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0,
                target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] as const,
            }
        },
        postMatch: {
            always: [
                { target: 'ability', guard: 'isAbilityCardOnTopOfAbilityStack' as const },
                { target: 'endOfTurn' }
            ] as const
        },
        endOfTurn: { always: { target: 'turn', actions: ['setNextPlayer', 'broadcastGameState'] as const } },
        error: { id: 'playing.error', /* ...error state logic... */ }
      },
    },
    [GameStage.FINAL_TURNS]: {
      id: GameStage.FINAL_TURNS,
      entry: ['setCurrentPlayerInFinalTurns', 'broadcastGameState'] as const,
      always: { target: GameStage.SCORING, guard: 'isCheckRoundOver' as const },
      initial: 'turn',
      states: {
        turn: {
            initial: TurnPhase.DRAW,
            entry: ['unsealDiscardPile', 'broadcastGameState'] as const,
            on: {
                [PlayerActionType.DRAW_FROM_DECK]: { target: 'discard', guard: not('isDeckEmpty'), actions: ['drawFromDeck', 'broadcastGameState'] as const },
                [PlayerActionType.DRAW_FROM_DISCARD]: { target: 'discardAfterDiscardDraw', guard: 'canDrawFromDiscard' as const, actions: ['drawFromDiscard', 'broadcastGameState'] as const },
            },
            always: { target: `#game.error`, guard: 'isDeckEmpty' as const, actions: ({ event }: { event: GameEvent }) => ({ type: 'enterErrorState', params: { errorType: 'DECK_EMPTY', event }}) }
        },
        discard: {
            on: {
                [PlayerActionType.SWAP_AND_DISCARD]: { guard: 'hasDrawnCard' as const, actions: 'swapAndDiscard', target: 'postDiscard' },
                [PlayerActionType.DISCARD_DRAWN_CARD]: { guard: and(['hasDrawnCard', 'wasDrawnFromDeck']), actions: 'discardDrawnCard', target: 'postDiscard' },
            },
        },
        discardAfterDiscardDraw: {
            on: { [PlayerActionType.SWAP_AND_DISCARD]: { guard: 'hasDrawnCard' as const, actions: 'swapAndDiscard', target: 'postDiscard' }, },
        },
        postDiscard: {
            entry: 'broadcastGameState' as const,
            always: [{ guard: 'isAbilityCardOnTopOfAbilityStack' as const, target: 'ability' }, { target: 'matching' }] as const
        },
        ability: {
            on: { [PlayerActionType.USE_ABILITY]: { guard: 'isValidAbilityAction' as const, actions: ['performAbilityAction', 'broadcastGameState'] as const } },
            always: { target: 'endOfTurn', guard: not('isAbilityCardOnTopOfAbilityStack') }
        },
        matching: {
            entry: ['setupMatchingOpportunity', 'broadcastGameState'] as const,
            invoke: { src: 'matchingTimerActor', onDone: { target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] as const } },
            on: {
                [PlayerActionType.ATTEMPT_MATCH]: { guard: 'canAttemptMatch' as const, actions: 'handleSuccessfulMatch', target: 'postMatch' },
                [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: { actions: 'handlePlayerPassedOnMatch' }
            },
            always: {
                guard: ({ context }: { context: GameContext }) => !context.matchingOpportunity || context.matchingOpportunity.remainingPlayerIDs.length === 0,
                target: 'endOfTurn', actions: ['clearMatchingOpportunity', 'broadcastGameState'] as const,
            }
        },
        postMatch: {
            always: [
                { target: 'ability', guard: 'isAbilityCardOnTopOfAbilityStack' as const },
                { target: 'endOfTurn' }
            ] as const
        },
        endOfTurn: {
          always: { target: `#game`, actions: ['setNextPlayerInFinalTurns', 'broadcastGameState'] as const }
        }
      }
    },
    [GameStage.SCORING]: {
        entry: ['calculateScores', 'broadcastGameState'] as const,
        after: { 5000: GameStage.GAMEOVER }
    },
    [GameStage.GAMEOVER]: {
        on: { [PlayerActionType.PLAY_AGAIN]: { target: GameStage.DEALING, actions: ['resetForNewRound', 'dealCards', 'broadcastGameState'] as const } },
    },
    error: {
      id: 'game.error',
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