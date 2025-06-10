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

// The server-side context now comes from the game machine itself.
// These types are defined locally in the machine file.
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
  pendingDrawnCard: {
    card: Card;
    source: 'deck' | 'discard';
  } | null;
  forfeited: boolean;
  status: PlayerStatus;
}

interface GameContext {
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
  const fullGameContext = snapshot.context;
  const clientPlayers: Record<PlayerId, Player> = {};

  for (const pId in fullGameContext.players) {
    const serverPlayer = fullGameContext.players[pId];
    const isViewingPlayer = pId === viewingPlayerId;

    let clientHand: (Card | { facedown: true })[];

    if (isViewingPlayer) {
      // The player can always see their own hand.
      // Specific peeking logic is handled by events, not general state updates.
      clientHand = serverPlayer.hand;
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

  const clientGameState: ClientCheckGameState = {
    gameId: fullGameContext.gameId,
    viewingPlayerId,
    gameMasterId: fullGameContext.gameMasterId,
    players: clientPlayers,
    deckSize: fullGameContext.deck.length,
    discardPile: fullGameContext.discardPile,
    turnOrder: fullGameContext.turnOrder,
    gameStage: snapshot.value as GameStage,
    currentPlayerId: fullGameContext.currentPlayerId,
    turnPhase: fullGameContext.currentTurnSegment,
    activeAbility: fullGameContext.activeAbility,
    matchingOpportunity: fullGameContext.matchingOpportunity,
    checkDetails: fullGameContext.checkDetails,
    gameover: fullGameContext.gameover,
    lastRoundLoserId: fullGameContext.lastRoundLoserId,
    log: fullGameContext.log,
    chat: fullGameContext.chat ?? [],
  };

  return clientGameState;
};