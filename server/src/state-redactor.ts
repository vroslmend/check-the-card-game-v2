import {
  Card,
  Player,
  PlayerId,
  ClientCheckGameState,
  GameStage,
  TurnPhase,
  RichGameLogMessage,
  PlayerStatus,
  ChatMessage,
  ActiveAbility,
} from 'shared-types';
import type { GameContext, ServerPlayer } from './game-machine.js';
import logger from './lib/logger.js';

// The server-side context now comes from the game machine itself.
// These types are defined locally in the machine file.


/**
 * Generates a player-specific view of the game state, redacting sensitive information.
 * @param snapshot The full snapshot from the server's machine.
 * @param viewingPlayerId The ID of the player for whom this view is being generated.
 * @returns A redacted game state object suitable for sending to the client.
 */
export const generatePlayerView = (
  snapshot: { context: GameContext, value: unknown },
  viewingPlayerId: string
): ClientCheckGameState => {
  const { context: fullGameContext, value: snapshotValue } = snapshot;
  logger.debug({ gameId: fullGameContext.gameId, viewingPlayerId }, 'Generating player view');

  const clientPlayers: Record<PlayerId, Player> = {};

  for (const pId in fullGameContext.players) {
    const serverPlayer = fullGameContext.players[pId];
    const isViewingPlayer = pId === viewingPlayerId;

    let clientHand: (Card | { facedown: true })[];

    if (isViewingPlayer) {
      // The player can always see their own hand. We explicitly map to ensure 
      // the type is correctly inferred as (Card | { facedown: true })[]
      // even though for the local player it will only ever contain Cards.
      clientHand = serverPlayer.hand.map(card => ({ id: card.id, suit: card.suit, rank: card.rank }));
    } else {
      // Other players' hands are always facedown.
      clientHand = serverPlayer.hand.map(() => ({ facedown: true as const }));
    }

    let clientPendingDrawnCard: Card | { facedown: true } | null = null;
    if (serverPlayer.pendingDrawnCard) {
      clientPendingDrawnCard = isViewingPlayer
        ? serverPlayer.pendingDrawnCard.card
        : { facedown: true as const };
    }

    clientPlayers[pId] = {
      id: serverPlayer.id,
      name: serverPlayer.name,
      hand: clientHand,
      status: serverPlayer.status,
      isReady: serverPlayer.isReady,
      isDealer: serverPlayer.isDealer,
      hasCalledCheck: serverPlayer.hasCalledCheck,
      isLocked: serverPlayer.isLocked,
      score: serverPlayer.score,
      isConnected: serverPlayer.isConnected,
      pendingDrawnCard: clientPendingDrawnCard,
    };
  }

  let gameStageValue: GameStage;
  if (typeof snapshot.value === 'string') {
    gameStageValue = snapshot.value as GameStage;
  } else if (typeof snapshot.value === 'object' && snapshot.value !== null) {
    // For nested states, the value is an object like { PLAYING: 'turn' }. We want the top-level key.
    gameStageValue = Object.keys(snapshot.value)[0] as GameStage;
  } else {
    // Fallback in case of an unexpected state value
    logger.warn({ value: snapshot.value, gameId: fullGameContext.gameId }, 'Unexpected snapshot value type, defaulting game stage.');
    gameStageValue = GameStage.WAITING_FOR_PLAYERS;
  }
  
  const clientGameState: ClientCheckGameState = {
    gameId: fullGameContext.gameId,
    viewingPlayerId,
    gameMasterId: fullGameContext.gameMasterId,
    players: clientPlayers,
    deckSize: fullGameContext.deck.length,
    discardPile: fullGameContext.discardPile,
    turnOrder: fullGameContext.turnOrder,
    gameStage: gameStageValue,
    currentPlayerId: fullGameContext.currentPlayerId,
    turnPhase: fullGameContext.currentTurnSegment,
    abilityStack: fullGameContext.abilityStack,
    matchingOpportunity: fullGameContext.matchingOpportunity,
    checkDetails: fullGameContext.checkDetails,
    gameover: fullGameContext.gameover,
    lastRoundLoserId: fullGameContext.lastRoundLoserId,
    log: fullGameContext.log,
    chat: fullGameContext.chat ?? [],
    discardPileIsSealed: fullGameContext.discardPileIsSealed,
  };

  logger.debug({ gameId: fullGameContext.gameId, viewingPlayerId, stage: clientGameState.gameStage, turnPhase: clientGameState.turnPhase }, 'Finished generating player view');
  return clientGameState;
};