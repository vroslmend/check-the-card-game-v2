import {
  Card,
  Rank,
  PlayerState,
  CheckGameState as ServerCheckGameState,
  HiddenCard,
  ClientCard,
  ClientPlayerState,
  ClientCheckGameState,
  GameOverData
} from 'shared-types';

export const generatePlayerView = (
  fullGameState: ServerCheckGameState,
  viewingPlayerId: string,
  // Optional parameter for temporary card reveals (e.g., for K/Q peek)
  temporaryReveals?: { [playerId: string]: { [cardIndex: number]: Card } }
): ClientCheckGameState => {
  const clientPlayers: { [playerID: string]: ClientPlayerState } = {};

  for (const pId in fullGameState.players) {
    const serverPlayerState = fullGameState.players[pId];
    let clientHand: ClientCard[];

    const revealsForThisPlayer = temporaryReveals?.[pId];

    if (pId === viewingPlayerId) {
      clientHand = serverPlayerState.hand.map((card, index) => {
        // SERVER-SIDE LOGGING FOR PLAYER VIEWING THEIR OWN HAND
        // console.log(`[DEBUG_generatePlayerView] Player ${pId} viewing own hand. Card[${index}]: ID=${card.id}, isFaceDownToOwner=${card.isFaceDownToOwner}, RawCard: ${JSON.stringify(card)}`);

        // Always send the full card details for the viewing player.
        // The client UI is responsible for rendering these as face-down by default.
        // Peeking (initial or ability-based) will temporarily override this on the client.
        return {
          ...card,
          id: card.id || `${pId}-card-${index}` // Use existing ID if present, else generate
        };
      });
    } else {
      clientHand = serverPlayerState.hand.map((card, index) => {
        if (revealsForThisPlayer?.[index]) {
          const revealedCard = revealsForThisPlayer[index];
          return {
            ...revealedCard,
            id: revealedCard.id || `${pId}-revealed-${index}` // Use existing ID if present
          };
        }
        return {
          isHidden: true,
          id: `${pId}-hidden-${index}` // Hidden cards always get a generated ID based on position
        };
      });
    }

    let cardsToPeekForClient: Card[] | null = null;
    if (pId === viewingPlayerId && serverPlayerState.cardsToPeek) {
        // Ensure cardsToPeek also have IDs, though they are raw Cards from server state
        // They might be used in UI elements expecting IDs.
        cardsToPeekForClient = serverPlayerState.cardsToPeek.map((c, idx) => ({
            ...c,
            id: c.id || `${pId}-peek-${idx}`
        }));
    }

    let clientPendingDrawnCard: ClientCard | null = null;
    if (pId === viewingPlayerId) {
      if (serverPlayerState.pendingDrawnCard) {
        if (!('isHidden' in serverPlayerState.pendingDrawnCard)) {
          const pdc = serverPlayerState.pendingDrawnCard as Card;
          clientPendingDrawnCard = {
            ...pdc,
            id: pdc.id || `${pId}-pendingdrawn-${pdc.rank}-${pdc.suit}` // Assign ID if missing
          };
        } else {
          // This case should ideally not happen if it's a known card for viewing player,
          // but handle if it's somehow a HiddenCard type from server state.
          clientPendingDrawnCard = {
            ...serverPlayerState.pendingDrawnCard,
            id: (serverPlayerState.pendingDrawnCard as HiddenCard).id || `${pId}-pendinghidden`
          };
        }
      }
    } else {
      clientPendingDrawnCard = serverPlayerState.pendingDrawnCard
        ? { isHidden: true, id: `pending-hidden-${pId}` }
        : null;
    }

    clientPlayers[pId] = {
      hand: clientHand,
      hasUsedInitialPeek: serverPlayerState.hasUsedInitialPeek,
      isReadyForInitialPeek: serverPlayerState.isReadyForInitialPeek,
      hasCompletedInitialPeek: serverPlayerState.hasCompletedInitialPeek,
      cardsToPeek: cardsToPeekForClient,
      peekAcknowledgeDeadline: pId === viewingPlayerId ? serverPlayerState.peekAcknowledgeDeadline : null,

      pendingDrawnCard: clientPendingDrawnCard, // Use the processed one with ID
      pendingDrawnCardSource: pId === viewingPlayerId ? serverPlayerState.pendingDrawnCardSource : null,

      pendingSpecialAbility: serverPlayerState.pendingSpecialAbility,

      hasCalledCheck: serverPlayerState.hasCalledCheck,
      isLocked: serverPlayerState.isLocked,
      score: serverPlayerState.score,
      name: serverPlayerState.name,
      isConnected: serverPlayerState.isConnected,
      numMatches: serverPlayerState.numMatches,
      numPenalties: serverPlayerState.numPenalties,
      explicitlyRevealedCards: undefined,
      forfeited: serverPlayerState.forfeited, // Pass through forfeited status
      turnTimerExpiresAt: fullGameState.playerTimers?.[pId]?.turnTimerExpiresAt,
      disconnectGraceTimerExpiresAt: fullGameState.playerTimers?.[pId]?.disconnectGraceTimerExpiresAt,
    };

    if (pId !== viewingPlayerId && revealsForThisPlayer) {
      clientPlayers[pId].explicitlyRevealedCards = { ...revealsForThisPlayer };
    }
  }

  const topDiscardCard = fullGameState.discardPile.length > 0 ? fullGameState.discardPile[0] : null;
  let isTopDiscardActuallySpecial = false;
  if (topDiscardCard) {
    isTopDiscardActuallySpecial = (topDiscardCard.rank === Rank.King ||
                                   topDiscardCard.rank === Rank.Queen ||
                                   topDiscardCard.rank === Rank.Jack);
  }
  const topDiscardFlagForClient = fullGameState.discardPileIsSealed || isTopDiscardActuallySpecial;

  let clientGameOverData: ClientCheckGameState['gameover'] = null;
  if (fullGameState.gameover) {
    clientGameOverData = {
      ...fullGameState.gameover,
      finalHands: fullGameState.gameover.finalHands
        ? Object.fromEntries(
            Object.entries(fullGameState.gameover.finalHands).map(([pId, hand]) => [
              pId,
              hand.map((card, index) => ({
                ...card,
                id: card.id || `${pId}-finalhand-${index}-${card.suit}-${card.rank}`
              }))
            ])
          )
        : undefined,
      playerStats: fullGameState.gameover.playerStats
        ? Object.fromEntries(
            Object.entries(fullGameState.gameover.playerStats).map(([pId, stats]) => [
                pId,
                {
                    ...stats,
                    name: stats.name || fullGameState.players[pId]?.name || `P-${pId.slice(-4)}`
                }
            ])
        )
        : undefined
    };
  }

  // Ensure all cards in the discard pile have IDs
  const clientDiscardPile = fullGameState.discardPile.map((card, index) => ({
    ...card,
    id: card.id || `discard-${index}-${card.rank}-${card.suit}` // Assign ID if missing
  }));

  const clientGameState: ClientCheckGameState = {
    ...fullGameState, // Spread the original game state
    deckSize: fullGameState.deck.length, // Overwrite deck with deckSize
    players: clientPlayers, // Overwrite players with clientPlayers
    topDiscardIsSpecialOrUnusable: topDiscardFlagForClient,

    discardPile: clientDiscardPile, // Use the processed discard pile with IDs
    // Ensure all other necessary fields from fullGameState are explicitly carried over or transformed
    discardPileIsSealed: fullGameState.discardPileIsSealed,
    matchingOpportunityInfo: fullGameState.matchingOpportunityInfo,
    playerWhoCalledCheck: fullGameState.playerWhoCalledCheck,
    roundWinner: fullGameState.roundWinner,
    finalTurnsTaken: fullGameState.finalTurnsTaken,
    initialPeekAllReadyTimestamp: fullGameState.initialPeekAllReadyTimestamp,
    globalAbilityTargets: fullGameState.globalAbilityTargets, // Pass through the new field

    currentPhase: fullGameState.currentPhase,
    currentPlayerId: fullGameState.currentPlayerId,
    turnOrder: fullGameState.turnOrder,
    gameMasterId: fullGameState.gameMasterId,
    activePlayers: fullGameState.activePlayers,
    pendingAbilities: fullGameState.pendingAbilities,
    gameover: clientGameOverData, // Use the transformed game over data
    matchResolvedDetails: fullGameState.matchResolvedDetails,

    viewingPlayerId: viewingPlayerId, // Add the viewingPlayerId
  };

  // Remove fields that should not be in ClientCheckGameState
  delete (clientGameState as any).deck;
  delete (clientGameState as any).lastResolvedAbilityCardForCleanup;
  delete (clientGameState as any).lastResolvedAbilitySource;

  return clientGameState;
};