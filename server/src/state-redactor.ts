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
  snapshot: { context: GameContext },
  viewingPlayerId: string,
): ClientCheckGameState => {
  const { context: fullGameContext } = snapshot;
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
      // A card taken from the discard pile was already public knowledge, so
      // everyone keeps seeing its face (real-life parity). Deck draws stay
      // hidden from everyone but the drawer.
      if (
        isViewingPlayer ||
        serverPlayer.pendingDrawnCard.source === "discard"
      ) {
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
      forfeited: serverPlayer.forfeited,
      pendingDrawnCard: clientPendingDrawnCard,
    };
  }

  const clientLog = fullGameContext.log.filter(
    (entry: RichGameLogMessage) =>
      entry.type === "public" ||
      (entry.type === "private" && entry.actor?.id === viewingPlayerId),
  );

  // Broadcasts carry only the recent tail — log and chat are append-only and
  // the client merges by id, keeping its full accumulated copy (rejoin gets
  // the complete log out-of-band). Without the cap every broadcast grew with
  // the length of the game.
  const BROADCAST_LOG_TAIL = 30;
  const BROADCAST_CHAT_TAIL = 30;

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
    discardPile: fullGameContext.discardPile.slice(-2),
    discardPileSize: fullGameContext.discardPile.length,
    turnOrder: fullGameContext.turnOrder,
    // context.gameStage is the single source of truth. Deriving the stage from
    // the machine's state value breaks whenever the machine is in a non-stage
    // node such as the error/recovery state.
    gameStage: fullGameContext.gameStage,
    currentPlayerId: fullGameContext.currentPlayerId,
    turnPhase: fullGameContext.currentTurnSegment,
    abilityStack: fullGameContext.abilityStack,
    matchingOpportunity: fullGameContext.matchingOpportunity,
    checkDetails: fullGameContext.checkDetails,
    winnerId: fullGameContext.winnerId,
    gameover: fullGameContext.gameover,
    lastRoundLoserId: fullGameContext.lastRoundLoserId,
    log: clientLog.slice(-BROADCAST_LOG_TAIL),
    chat: (fullGameContext.chat ?? []).slice(-BROADCAST_CHAT_TAIL),
    discardPileIsSealed: fullGameContext.discardPileIsSealed,
    // Positions only — card faces are never part of publicPeek.
    publicPeek: fullGameContext.publicPeek,
    // Positions only — card faces are never part of publicSwap.
    publicSwap: fullGameContext.publicSwap,
    turnDeadline: fullGameContext.turnDeadline,
    turnTimerMs: fullGameContext.turnTimerMs,
    maxPlayers: fullGameContext.maxPlayers,
    serverNow: Date.now(),
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
