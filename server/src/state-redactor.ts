import {
  Card,
  FacedownCard,
  PublicCard,
  Player,
  PlayerId,
  ClientCheckGameState,
  GameStage,
  RichGameLogMessage,
} from "shared-types";
import type { GameContext } from "./game-machine.js";
import logger from "./lib/logger.js";

/**
 * Generates a player-specific view of the game state, redacting sensitive information.
 * @param snapshot The full snapshot from the server's machine.
 * @param viewingPlayerId The ID of the player for whom this view is being generated.
 * @returns A redacted game state object suitable for sending to the client.
 */
export const generatePlayerView = (
  snapshot: { context: GameContext; value: unknown },
  viewingPlayerId: string,
): ClientCheckGameState => {
  const { context: fullGameContext, value: snapshotValue } = snapshot;
  logger.debug(
    { gameId: fullGameContext.gameId, viewingPlayerId },
    "Generating player view",
  );

  const clientPlayers: Record<PlayerId, Player> = {};

  for (const pId in fullGameContext.players) {
    const serverPlayer = fullGameContext.players[pId];
    const isViewingPlayer = pId === viewingPlayerId;

    const revealAll =
      fullGameContext.gameStage === GameStage.SCORING ||
      fullGameContext.gameStage === GameStage.GAMEOVER;

    const clientHand: PublicCard[] = serverPlayer.hand.map((card: Card) => {
      // During scoring/gameover everyone can see all cards
      if (revealAll) return card;

      // Otherwise, only the owner sees their cards.
      if (isViewingPlayer) return card;

      // Opponents' cards remain hidden.
      return { facedown: true as const, id: card.id };
    });

    let clientPendingDrawnCard: { card: PublicCard; source: "deck" | "discard" } | null = null;
    if (serverPlayer.pendingDrawnCard) {
      if (isViewingPlayer) {
        clientPendingDrawnCard = { 
          card: serverPlayer.pendingDrawnCard.card,
          source: serverPlayer.pendingDrawnCard.source,
        };
      } else {
        clientPendingDrawnCard = {
          card: { id: serverPlayer.pendingDrawnCard.card.id, facedown: true },
          source: serverPlayer.pendingDrawnCard.source,
        };
      }
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
  if (typeof snapshot.value === "string") {
    gameStageValue = snapshot.value as GameStage;
  } else if (typeof snapshot.value === "object" && snapshot.value !== null) {
    gameStageValue = Object.keys(snapshot.value)[0] as GameStage;
  } else {
    logger.warn(
      { value: snapshot.value, gameId: fullGameContext.gameId },
      "Unexpected snapshot value type, defaulting game stage.",
    );
    gameStageValue = GameStage.WAITING_FOR_PLAYERS;
  }

  const clientLog = fullGameContext.log.filter(
    (entry: RichGameLogMessage) =>
      entry.type === "public" ||
      (entry.type === "private" && entry.actor?.id === viewingPlayerId),
  );

  const clientGameState: ClientCheckGameState = {
    gameId: fullGameContext.gameId,
    viewingPlayerId,
    gameMasterId: fullGameContext.gameMasterId,
    players: clientPlayers,
    deckSize: fullGameContext.deck.length,
    deckTop:
      fullGameContext.deck.length > 0
        ? {
            facedown: true,
            id: fullGameContext.deck[fullGameContext.deck.length - 1]!.id,
          }
        : null,
    discardPile: fullGameContext.discardPile,
    turnOrder: fullGameContext.turnOrder,
    gameStage: gameStageValue,
    currentPlayerId: fullGameContext.currentPlayerId,
    turnPhase: fullGameContext.currentTurnSegment,
    abilityStack: fullGameContext.abilityStack,
    matchingOpportunity: fullGameContext.matchingOpportunity,
    checkDetails: fullGameContext.checkDetails,
    winnerId: fullGameContext.winnerId,
    gameover: fullGameContext.gameover,
    lastRoundLoserId: fullGameContext.lastRoundLoserId,
    log: clientLog,
    chat: fullGameContext.chat ?? [],
    discardPileIsSealed: fullGameContext.discardPileIsSealed,
  };

  logger.debug(
    {
      gameId: fullGameContext.gameId,
      viewingPlayerId,
      stage: clientGameState.gameStage,
      turnPhase: clientGameState.turnPhase,
    },
    "Finished generating player view",
  );
  return clientGameState;
};
