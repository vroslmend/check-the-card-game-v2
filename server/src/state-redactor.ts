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
  activeAbility: ActiveAbility | null;
  log: RichGameLogMessage[];
  chat: ChatMessage[]; // Assuming chat is handled elsewhere but part of the type.
  [key: string]: any; // Allow other properties
}


/**
 * Generates a player-specific view of the game state, redacting sensitive information.
 * @param fullGameContext The complete, authoritative game context from the server's machine.
 * @param viewingPlayerId The ID of the player for whom this view is being generated.
 * @returns A redacted game state object suitable for sending to the client.
 */
export const generatePlayerView = (
  fullGameContext: GameContext,
  viewingPlayerId: string
): ClientCheckGameState => {
  const clientPlayers: Record<PlayerId, Player> = {};

  for (const pId in fullGameContext.players) {
    const serverPlayer = fullGameContext.players[pId];
    const isViewingPlayer = pId === viewingPlayerId;
    const isDealingStage = fullGameContext.gameStage === GameStage.DEALING;

    let clientHand: (Card | { facedown: true })[];

    if (isViewingPlayer) {
      if (isDealingStage) {
        // Rule: During the DEALING stage, players can only peek at their bottom two cards (indices 2 and 3).
        clientHand = serverPlayer.hand.map((card, index) => {
          return (index === 2 || index === 3) ? card : { facedown: true as const };
        });
      } else {
        // Outside of dealing, the player can see their whole hand.
        clientHand = serverPlayer.hand;
      }
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
    players: clientPlayers,
    deckSize: fullGameContext.deck.length,
    discardPile: fullGameContext.discardPile,
    turnOrder: fullGameContext.turnOrder,
    gameStage: fullGameContext.gameStage ?? GameStage.WAITING_FOR_PLAYERS,
    currentPlayerId: fullGameContext.currentPlayerId,
    turnPhase: fullGameContext.currentTurnSegment,
    activeAbility: fullGameContext.activeAbility,
    checkDetails: fullGameContext.checkDetails,
    gameover: fullGameContext.gameover,
    lastRoundLoserId: fullGameContext.lastRoundLoserId,
    log: fullGameContext.log,
    chat: fullGameContext.chat ?? [],
  };

  return clientGameState;
};