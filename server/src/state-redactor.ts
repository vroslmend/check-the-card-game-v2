import {
  Card,
  Player,
  PlayerId,
  ClientCheckGameState,
  GameStage,
} from 'shared-types';
import type { GameContext } from './game-machine.js';
import logger from './lib/logger.js';

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

    // Redact opponent hands
    const clientHand: (Card | { facedown: true })[] = isViewingPlayer
      ? serverPlayer.hand
      : serverPlayer.hand.map(() => ({ facedown: true as const }));
    
    // Correctly redact the pending drawn card according to our new shared type
    let clientPendingDrawnCard: { card: Card, source: string } | null = null;
    if (serverPlayer.pendingDrawnCard) {
      if (isViewingPlayer) {
        clientPendingDrawnCard = { card: serverPlayer.pendingDrawnCard.card, source: serverPlayer.pendingDrawnCard.source };
      }
      // If not the viewing player, it remains null, correctly hiding the info.
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
    gameStageValue = Object.keys(snapshot.value)[0] as GameStage;
  } else {
    logger.warn({ value: snapshot.value, gameId: fullGameContext.gameId }, 'Unexpected snapshot value type, defaulting game stage.');
    gameStageValue = GameStage.WAITING_FOR_PLAYERS;
  }
  
  const clientLog = fullGameContext.log.filter(entry => 
      entry.type === 'public' || 
      (entry.type === 'private' && entry.actor?.id === viewingPlayerId)
  );

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
    log: clientLog,
    chat: fullGameContext.chat ?? [],
    discardPileIsSealed: fullGameContext.discardPileIsSealed,
  };

  logger.debug({ gameId: fullGameContext.gameId, viewingPlayerId, stage: clientGameState.gameStage, turnPhase: clientGameState.turnPhase }, 'Finished generating player view');
  return clientGameState;
};