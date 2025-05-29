import { Game, type Ctx } from 'boardgame.io';
import { Card, Suit, Rank, PlayerState, CheckGameState as SharedCheckGameState, cardValues } from 'shared-types';

// Helper function to create a standard 52-card deck
const createDeck = (): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

// Define all game moves in a separate object
const allGameMoves = {
  drawFromDeck: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    if (player.pendingDrawnCard || player.pendingSpecialAbility) return;
    if (G.deck.length === 0) return;
    const card = G.deck.pop();
    if (!card) return;
    player.pendingDrawnCard = card;
    player.pendingDrawnCardSource = 'deck';
  },
  drawFromDiscard: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    if (player.pendingDrawnCard) return;
    if (G.discardPile.length === 0) return;
    if (G.discardPileIsSealed) return;
    const card = G.discardPile.pop();
    if (!card) return;
    player.pendingDrawnCard = card;
    player.pendingDrawnCardSource = 'discard';
  },
  swapAndDiscard: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any, ctx: Ctx }, handIndex: number) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (handIndex < 0 || handIndex >= player.hand.length) return;
    const discardedCard = player.hand[handIndex];
    player.hand[handIndex] = player.pendingDrawnCard;
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
    G.discardPile.push(discardedCard);
    G.matchingOpportunityInfo = {
      cardToMatch: discardedCard,
      originalPlayerID: playerID,
    };
    events.setPhase('matchingStage');
  },
  discardDrawnCard: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any, ctx: Ctx }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (player.pendingDrawnCardSource !== 'deck') return;
    const discardedCard = player.pendingDrawnCard;
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
    G.discardPile.push(discardedCard);
    G.matchingOpportunityInfo = {
      cardToMatch: discardedCard,
      originalPlayerID: playerID,
    };
    events.setPhase('matchingStage');
  },
  resolveSpecialAbility: ({ G, playerID, events }: { G: SharedCheckGameState; playerID?: string; events: any }, abilityArgs?: any) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingSpecialAbility) return;
    if (player.isLocked) {
      console.log(`Player ${playerID} is locked. Skipping resolveSpecialAbility for ${player.pendingSpecialAbility.card.rank}.`);
      G.lastResolvedAbilitySource = player.pendingSpecialAbility.source;
      player.pendingSpecialAbility = null;
      events.endStage();
      return;
    }
    const { card, source } = player.pendingSpecialAbility;
    let abilityPerformed = false;
    if (card.rank === Rank.King) {
      if (abilityArgs && abilityArgs.peekTargets && abilityArgs.peekTargets.length === 2 && abilityArgs.swapA && abilityArgs.swapB) {
        const aPlayer = G.players[abilityArgs.swapA.playerID];
        const bPlayer = G.players[abilityArgs.swapB.playerID];
        if (aPlayer && bPlayer) {
            const aCard = aPlayer.hand[abilityArgs.swapA.cardIndex];
            const bCard = bPlayer.hand[abilityArgs.swapB.cardIndex];
            if (aCard !== undefined && bCard !== undefined) {
              aPlayer.hand[abilityArgs.swapA.cardIndex] = bCard;
              bPlayer.hand[abilityArgs.swapB.cardIndex] = aCard;
              abilityPerformed = true;
            }
        }
      }
    } else if (card.rank === Rank.Queen) {
      if (abilityArgs && abilityArgs.peekTargets && abilityArgs.peekTargets.length === 1 && abilityArgs.swapA && abilityArgs.swapB) {
        const aPlayer = G.players[abilityArgs.swapA.playerID];
        const bPlayer = G.players[abilityArgs.swapB.playerID];
        if (aPlayer && bPlayer) {
            const aCard = aPlayer.hand[abilityArgs.swapA.cardIndex];
            const bCard = bPlayer.hand[abilityArgs.swapB.cardIndex];
            if (aCard !== undefined && bCard !== undefined) {
              aPlayer.hand[abilityArgs.swapA.cardIndex] = bCard;
              bPlayer.hand[abilityArgs.swapB.cardIndex] = aCard;
              abilityPerformed = true;
            }
        }
      }
    } else if (card.rank === Rank.Jack) {
      if (abilityArgs && abilityArgs.swapA && abilityArgs.swapB) {
        const aPlayer = G.players[abilityArgs.swapA.playerID];
        const bPlayer = G.players[abilityArgs.swapB.playerID];
        if (aPlayer && bPlayer) {
            const aCard = aPlayer.hand[abilityArgs.swapA.cardIndex];
            const bCard = bPlayer.hand[abilityArgs.swapB.cardIndex];
            if (aCard !== undefined && bCard !== undefined) {
              aPlayer.hand[abilityArgs.swapA.cardIndex] = bCard;
              bPlayer.hand[abilityArgs.swapB.cardIndex] = aCard;
              abilityPerformed = true;
            }
        }
      }
    }
    G.lastResolvedAbilitySource = source;
    player.pendingSpecialAbility = null;
    if (abilityPerformed) console.log(`Player ${playerID} resolved ${card.rank} ability successfully.`);
    else console.log(`Player ${playerID} resolved ${card.rank} ability (fizzled or args invalid).`);
    events.endStage();
  },
  drawCard: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }) => {
    if (!playerID) return;
    if (G.deck.length > 0) {
      const card = G.deck.pop();
      if (card) {
        if (!G.players[playerID]) {
          G.players[playerID] = {
            hand: [],
            hasUsedInitialPeek: false,
            isReadyForInitialPeek: false,
            hasCompletedInitialPeek: false,
            pendingDrawnCard: null,
            pendingDrawnCardSource: null,
            pendingSpecialAbility: null,
            hasCalledCheck: false,
            isLocked: false,
            score: 0
          };
        }
        G.players[playerID].hand.push(card);
      }
    }
  },
  performPeek: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }, cardIndices: number[]) => {
    if (!playerID || !G.players[playerID]) return;
    if (G.players[playerID].hasUsedInitialPeek) return;
    if (G.players[playerID].hand.length < 2) return;
    G.players[playerID].hasUsedInitialPeek = true;
  },
  attemptMatch: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }, handIndex: number) => {
    if (!playerID) return 'INVALID_MOVE';
    const player = G.players[playerID];
    if (!player || handIndex < 0 || handIndex >= player.hand.length) return 'INVALID_MOVE';
    if (ctx.phase !== 'matchingStage' || !ctx.activePlayers || !ctx.activePlayers[playerID!]) {
        console.error(`[Server] attemptMatch INVALID_MOVE for player ${playerID}. Conditions: playerID=${playerID}, ctx.phase=${ctx.phase}, activeInSomeStage=${ctx.activePlayers ? !!ctx.activePlayers[playerID!] : false}`);
        return 'INVALID_MOVE';
    }
    const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo || {};
    if (!cardToMatch || !originalPlayerID) return 'INVALID_MOVE';
    const cardY = player.hand[handIndex];
    const cardX = cardToMatch;
    if (cardY.rank === cardX.rank) {
      player.hand.splice(handIndex, 1);
      G.discardPile.push(cardY);
      G.discardPileIsSealed = true;
      let isAutoCheck = false;
      let abilityResolutionRequired = false;
      const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank);
      const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardY.rank);
      if (isCardXSpecial && isCardYSpecial) {
        player.pendingSpecialAbility = { card: cardY, source: 'stack' };
        if (G.players[originalPlayerID]) G.players[originalPlayerID].pendingSpecialAbility = { card: cardX, source: 'stackSecondOfPair' };
        abilityResolutionRequired = true;
      }
      if (player.hand.length === 0) {
        player.hasCalledCheck = true;
        player.isLocked = true;
        if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = playerID;
        G.finalTurnsTaken = 0;
        isAutoCheck = true;
      }
      G.matchingOpportunityInfo = null;
      if (isAutoCheck && abilityResolutionRequired) {
        events.setActivePlayers({ currentPlayer: 'abilityResolutionStage' });
        return;
      } else if (isAutoCheck && !abilityResolutionRequired) {
        events.setPhase('finalTurnsPhase');
        return;
      } else if (!isAutoCheck && abilityResolutionRequired) {
        events.setActivePlayers({ currentPlayer: 'abilityResolutionStage' });
        return;
      }
      events.endStage();
    } else {
      return 'INVALID_MOVE';
    }
  },
  passMatch: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    console.log(`[Server] Attempting passMatch for player ${playerID}. Current phase: ${ctx.phase}, Current activePlayers: ${JSON.stringify(ctx.activePlayers)}, player's stage: ${ctx.activePlayers ? ctx.activePlayers[playerID!] : 'N/A'}`);

    if (!playerID || ctx.phase !== 'matchingStage' || !ctx.activePlayers || !ctx.activePlayers[playerID!]) {
      console.error(`[Server] passMatch INVALID_MOVE for player ${playerID}. Conditions: playerID=${playerID}, ctx.phase=${ctx.phase}, activeInSomeStage=${ctx.activePlayers ? !!ctx.activePlayers[playerID!] : false}`);
      return 'INVALID_MOVE';
    }
    // If player is in matchingStage phase and active, proceed
    console.log(`[Server] Player ${playerID} successfully called passMatch. Ending stage for this player.`);
    events.endStage(); // This will trigger matchingStage.turn.onEnd when all players in the stage have made their moveLimit: 1 move
  },
  callCheck: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || ctx.currentPlayer !== playerID || player.hasCalledCheck || player.pendingDrawnCard || player.pendingSpecialAbility || ctx.phase !== 'playPhase') return;
    player.hasCalledCheck = true;
    player.isLocked = true;
    if (!G.playerWhoCalledCheck) G.playerWhoCalledCheck = playerID;
    G.finalTurnsTaken = 0;
    events.endTurn();
    events.setPhase('finalTurnsPhase');
  },
  declareReadyForPeek: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    if (!playerID || !G.players[playerID] || G.players[playerID].isReadyForInitialPeek) return 'INVALID_MOVE';
    if (ctx.phase !== 'initialPeekPhase' || ctx.activePlayers?.[playerID!] !== 'waitingForReadyStage') return 'INVALID_MOVE';

    G.players[playerID].isReadyForInitialPeek = true;

    let allPlayersReady = true;
    for (const pID in G.players) {
      if (!G.players[pID].isReadyForInitialPeek) {
        allPlayersReady = false;
        break;
      }
    }

    if (allPlayersReady) {
      G.initialPeekAllReadyTimestamp = Date.now();
      console.log(`[Server] All players ready for peek. Timestamp: ${G.initialPeekAllReadyTimestamp}`);
      const nextStagesConfig: Record<string, string> = {};
      Object.keys(G.players).forEach(pID => {
        nextStagesConfig[pID] = 'revealingCardsStage';
      });
      events.setActivePlayers({ value: nextStagesConfig });
    }
  },
  checkInitialPeekTimer: ({G, playerID, events, ctx}: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    if (ctx.phase !== 'initialPeekPhase' || !G.initialPeekAllReadyTimestamp) return;

    let allRelevantPlayersInRevealStage = true;
    if (!ctx.activePlayers) {
        allRelevantPlayersInRevealStage = false;
    } else {
        let inRevealStageCount = 0;
        let readyForPeekCount = 0;
        for(const pID_ctx in ctx.activePlayers) { 
            if (G.players[pID_ctx]?.isReadyForInitialPeek) {
                readyForPeekCount++;
                if (ctx.activePlayers[pID_ctx] === 'revealingCardsStage') {
                    inRevealStageCount++;
                }
            }
        }
        if (readyForPeekCount === 0 || inRevealStageCount < readyForPeekCount) {
             allRelevantPlayersInRevealStage = false;
        }
    }
    
    if (!allRelevantPlayersInRevealStage) {
        return; 
    }

    const PEEK_COUNTDOWN_MS = 3 * 1000; 
    const PEEK_REVEAL_MS = 5 * 1000;   
    const phaseEndTime = G.initialPeekAllReadyTimestamp + PEEK_COUNTDOWN_MS + PEEK_REVEAL_MS;

    if (Date.now() >= phaseEndTime) {
      for (const pID_g in G.players) { 
        if (G.players[pID_g].isReadyForInitialPeek && !G.players[pID_g].hasCompletedInitialPeek) {
          G.players[pID_g].hasCompletedInitialPeek = true;
          G.players[pID_g].hasUsedInitialPeek = true;
          console.log(`[Server] Auto-completed initial peek for player ${pID_g} via checkInitialPeekTimer`);
        }
      }
    }
  },
};

export const CheckGame: Game<SharedCheckGameState> = {
  name: 'Check',
  setup: ({ ctx, random } : { ctx: Ctx, random: { Die: (sides: number) => number; Shuffle: <T>(deck: T[]) => T[]; [key: string]: any; } }) => {
    const numPlayers = ctx.numPlayers;
    const deck = createDeck();
    const shuffledDeck = random.Shuffle(deck) as Card[];
    const initialPlayers: { [playerID: string]: PlayerState } = {};
    for (let i = 0; i < numPlayers; i++) {
      const playerID = i.toString();
      initialPlayers[playerID] = {
        hand: shuffledDeck.splice(0, 4),
        hasUsedInitialPeek: false,
        isReadyForInitialPeek: false,
        hasCompletedInitialPeek: false,
        pendingDrawnCard: null,
        pendingDrawnCardSource: null,
        pendingSpecialAbility: null,
        hasCalledCheck: false,
        isLocked: false,
        score: 0,
      };
    }
    return {
      deck: shuffledDeck,
      players: initialPlayers,
      discardPile: [],
      discardPileIsSealed: false,
      matchingOpportunityInfo: null,
      playerWhoCalledCheck: null,
      roundWinner: null,
      finalTurnsTaken: 0,
      lastResolvedAbilitySource: null,
      initialPeekAllReadyTimestamp: null,
      lastPlayerToResolveAbility: null,
      lastResolvedAbilityCardForCleanup: null,
    } as SharedCheckGameState;
  },
  moves: allGameMoves,
  phases: {
    initialPeekPhase: {
      start: true,
      turn: {
        activePlayers: { all: 'waitingForReadyStage' },
        stages: {
          waitingForReadyStage: {
            moves: { declareReadyForPeek: allGameMoves.declareReadyForPeek },
          },
          revealingCardsStage: {
            moves: { checkInitialPeekTimer: allGameMoves.checkInitialPeekTimer },
          },
        }
      },
      endIf: ({ G, ctx }: { G: SharedCheckGameState, ctx: Ctx }) => {
        if (!G.initialPeekAllReadyTimestamp) {
            return false; 
        }
        for (const playerID_g in G.players) { 
          if (G.players[playerID_g].isReadyForInitialPeek && !G.players[playerID_g].hasCompletedInitialPeek) {
            return false;
          }
        }
        console.log('[Server] initialPeekPhase endIf: All relevant players have completed. Ending phase.');
        return { next: 'playPhase' };
      },
      onEnd: ({ G }: { G: SharedCheckGameState }) => { 
        G.initialPeekAllReadyTimestamp = null; 
        for (const playerID_g in G.players) { 
            G.players[playerID_g].isReadyForInitialPeek = false; 
        }
        console.log('[Server] initialPeekPhase.onEnd executed. isReadyForInitialPeek flags reset.');
      },
    },
    playPhase: {
      turn: {},
      moves: {
        drawFromDeck: allGameMoves.drawFromDeck,
        drawFromDiscard: allGameMoves.drawFromDiscard,
        swapAndDiscard: allGameMoves.swapAndDiscard,
        discardDrawnCard: allGameMoves.discardDrawnCard,
        resolveSpecialAbility: allGameMoves.resolveSpecialAbility,
        callCheck: allGameMoves.callCheck,
      },
      onEnd: ({ G, ctx, events }) => {
        if (G.matchingOpportunityInfo) return;
        const currentPlayerState = G.players[ctx.currentPlayer];
        if (currentPlayerState && currentPlayerState.pendingSpecialAbility) return;
      },
    },
    finalTurnsPhase: {
      turn: {
        order: {
          first: ({ ctx }) => ctx.playOrderPos,
          next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },
        onBegin: ({ G, ctx, events }) => {
          const currentPlayerState = G.players[ctx.currentPlayer];
          if (currentPlayerState.isLocked || ctx.currentPlayer === G.playerWhoCalledCheck) events.endTurn();
        },
        onEnd: ({ G, ctx }) => {
          const playerWhoseTurnEnded = ctx.currentPlayer;
          if (playerWhoseTurnEnded && playerWhoseTurnEnded !== G.playerWhoCalledCheck) {
            if (G.finalTurnsTaken === undefined) G.finalTurnsTaken = 0;
            G.finalTurnsTaken++;
          }
        },
      },
      moves: {
        drawFromDeck: (context) => { if (context.playerID && context.G.players[context.playerID]?.isLocked) return; allGameMoves.drawFromDeck(context); },
        drawFromDiscard: (context) => { if (context.playerID && context.G.players[context.playerID]?.isLocked) return; allGameMoves.drawFromDiscard(context); },
        swapAndDiscard: (context, handIndex) => { if (context.playerID && context.G.players[context.playerID]?.isLocked) return; allGameMoves.swapAndDiscard(context, handIndex); },
        discardDrawnCard: (context) => { if (context.playerID && context.G.players[context.playerID]?.isLocked) return; allGameMoves.discardDrawnCard(context); },
        resolveSpecialAbility: (context, abilityArgs) => { if (context.playerID && context.G.players[context.playerID]?.isLocked && !context.G.players[context.playerID]?.pendingSpecialAbility) return; allGameMoves.resolveSpecialAbility(context, abilityArgs); },
        attemptMatch: allGameMoves.attemptMatch,
      },
      endIf: ({ G, ctx }) => {
        if (G.finalTurnsTaken === undefined) G.finalTurnsTaken = 0;
        const expectedFinalTurns = ctx.numPlayers - 1;
        if (!G.playerWhoCalledCheck) return false;
        if (expectedFinalTurns <= 0) return { next: 'scoringPhase' };
        if (G.finalTurnsTaken >= expectedFinalTurns) return { next: 'scoringPhase' };
        return false;
      },
      next: 'scoringPhase',
    },
    scoringPhase: {
      onBegin: ({ G, ctx, events }) => {
        let roundWinnerID: string | null = null;
        let lowestScore = Infinity;
        for (const playerID in G.players) {
          const player = G.players[playerID];
          let currentHandScore = 0;
          player.hand.forEach(card => { currentHandScore += cardValues[card.rank]; });
          player.score = currentHandScore;
          if (player.score < lowestScore) {
            lowestScore = player.score;
            roundWinnerID = playerID;
          } else if (player.score === lowestScore) {
            roundWinnerID = roundWinnerID ? `${roundWinnerID}, ${playerID}` : playerID;
          }
        }
        G.roundWinner = roundWinnerID;
        events.endGame({ winner: G.roundWinner, scores: G.players });
      },
    },
    matchingStage: {
      moves: {
        attemptMatch: allGameMoves.attemptMatch,
        passMatch: allGameMoves.passMatch,
      },
      onBegin: ({ G, ctx, events }) => {
        console.log(`[Server] matchingStage.onBegin: ctx.phase=${ctx.phase}, ctx.currentPlayer=${ctx.currentPlayer}, ctx.activePlayers=${JSON.stringify(ctx.activePlayers)}`);
        // Explicitly set all players to the 'stage' with a move limit.
        // This is an attempt to ensure activePlayers is set before allowedMoves might be calculated or checked.
        const allPlayersStage: Record<string, string> = {};
        Object.keys(G.players).forEach(pID => allPlayersStage[pID] = 'stage');
        events.setActivePlayers({ value: allPlayersStage, moveLimit: 1 });
        console.log(`[Server] matchingStage.onBegin: Explicitly called setActivePlayers. New ctx.activePlayers should be (but might not be immediately visible in this log): ${JSON.stringify(allPlayersStage)}`);
      },
      turn: { 
        activePlayers: { all: 'stage', moveLimit: 1 }, // All players are active in a generic 'stage'
        onEnd: ({G, ctx, events}) => { 
            console.log(`[Server] matchingStage.turn.onEnd triggered. currentPlayer at turn end: ${ctx.currentPlayer}`);
            const originalMatchingInfo = G.matchingOpportunityInfo;
            const cardX = originalMatchingInfo?.cardToMatch;
            const originalDiscarderID = originalMatchingInfo?.originalPlayerID;

            if (G.matchingOpportunityInfo === null && originalMatchingInfo !== null) { 
                console.log("[Server] matchingStage.onEnd: Successful match detected or opportunity cleared.");
                let nextPlayerForAbility: string | null = null;
                let abilitySourcePriority: 'stack' | 'stackSecondOfPair' | null = null;

                for (const playerID_loop in G.players) {
                    const playerState = G.players[playerID_loop];
                    if (playerState.pendingSpecialAbility) {
                        if (playerState.pendingSpecialAbility.source === 'stack') {
                            nextPlayerForAbility = playerID_loop; abilitySourcePriority = 'stack'; break;
                        } else if (playerState.pendingSpecialAbility.source === 'stackSecondOfPair' && !abilitySourcePriority) {
                            nextPlayerForAbility = playerID_loop; abilitySourcePriority = 'stackSecondOfPair';
                        }
                    }
                }

                if (nextPlayerForAbility) {
                    console.log(`[Server] matchingStage.onEnd: Transitioning to abilityResolutionStage for player ${nextPlayerForAbility}`);
                    G.lastPlayerToResolveAbility = null;
                    events.setPhase('abilityResolutionStage'); 
                    return;
                }
            } 
            
            if (originalMatchingInfo !== null) { 
                console.log("[Server] matchingStage.onEnd: No stack abilities, checking for discard ability.");
                G.discardPileIsSealed = false;
                if (cardX && originalDiscarderID && G.players[originalDiscarderID]?.pendingSpecialAbility?.card.rank === cardX.rank && G.players[originalDiscarderID]?.pendingSpecialAbility?.source === 'discard') {
                    console.log(`[Server] matchingStage.onEnd: Discard ability for ${originalDiscarderID} already set. Transitioning to abilityResolutionStage.`);
                    G.lastPlayerToResolveAbility = null;
                    events.setPhase('abilityResolutionStage');
                    G.matchingOpportunityInfo = null;
                    return;
                } else if (cardX && originalDiscarderID && [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank) && !G.players[originalDiscarderID]?.pendingSpecialAbility) {
                    console.log(`[Server] matchingStage.onEnd: Setting discard ability for ${originalDiscarderID} and transitioning.`);
                    G.players[originalDiscarderID].pendingSpecialAbility = { card: cardX, source: 'discard' };
                    G.lastPlayerToResolveAbility = null;
                    events.setPhase('abilityResolutionStage');
                    G.matchingOpportunityInfo = null; 
                    return;
                }
            }

            console.log("[Server] matchingStage.onEnd: No abilities to resolve, or opportunity passed. Transitioning to playPhase.");
            G.matchingOpportunityInfo = null;
            G.discardPileIsSealed = false;
            events.setPhase('playPhase'); 
        }
      }
    },
    abilityResolutionStage: {
      moves: { resolveSpecialAbility: allGameMoves.resolveSpecialAbility },
      turn: {
        onBegin: ({G, ctx, events}) => {
            let playerWithAbility: string | null = null;
            const sources: Array<'stack' | 'stackSecondOfPair' | 'discard'> = ['stack', 'stackSecondOfPair', 'discard'];
            for (const source of sources) {
                for (const pID in G.players) {
                    if (G.players[pID].pendingSpecialAbility?.source === source && pID !== G.lastPlayerToResolveAbility) {
                        playerWithAbility = pID;
                        break;
                    }
                }
                if (playerWithAbility) break;
            }

            if (playerWithAbility) {
                console.log(`[Server] abilityResolutionStage.onBegin: Setting active player to ${playerWithAbility} for ability resolution.`);
                events.setActivePlayers({ currentPlayer: playerWithAbility });
            } else {
                console.error("[Server] abilityResolutionStage.onBegin: No player found with a pending ability! Transitioning to playPhase.");
                events.setPhase('playPhase');
            }
        },
      },
      onEnd: ({G, ctx, events}) => {
          const resolvedPlayerID = ctx.currentPlayer;
          console.log(`[Server] abilityResolutionStage.onEnd for player ${resolvedPlayerID}. Last source: ${G.lastResolvedAbilitySource}`);
          G.lastPlayerToResolveAbility = resolvedPlayerID;

          if (G.players[resolvedPlayerID]?.pendingSpecialAbility && G.players[resolvedPlayerID]?.pendingSpecialAbility?.card.rank === G.lastResolvedAbilityCardForCleanup?.rank) {
          }
          G.lastResolvedAbilityCardForCleanup = null;

          let nextPlayerForAbility: string | null = null;
          const sources: Array<'stack' | 'stackSecondOfPair' | 'discard'> = ['stack', 'stackSecondOfPair', 'discard'];
            for (const source of sources) {
                for (const pID in G.players) {
                    if (G.players[pID].pendingSpecialAbility && pID !== G.lastPlayerToResolveAbility) {
                        nextPlayerForAbility = pID;
                        break;
                    }
                    if (G.players[pID].pendingSpecialAbility && pID === G.lastPlayerToResolveAbility && G.players[pID].pendingSpecialAbility?.source !== G.lastResolvedAbilitySource ) {
                        nextPlayerForAbility = pID;
                        break;
                    }
                }
                if (nextPlayerForAbility) break;
            }

          if (nextPlayerForAbility) {
              console.log(`[Server] abilityResolutionStage.onEnd: Found next player ${nextPlayerForAbility} for ability. Staying in phase.`);
              events.endTurn();
              return;
          }
          
          console.log("[Server] abilityResolutionStage.onEnd: No more abilities to resolve.");
          G.lastResolvedAbilitySource = null;
          G.lastPlayerToResolveAbility = null;

          if (G.playerWhoCalledCheck) {
              console.log("[Server] abilityResolutionStage.onEnd: Player has called Check. Transitioning to finalTurnsPhase.");
              events.setPhase('finalTurnsPhase');
          } else {
              console.log("[Server] abilityResolutionStage.onEnd: No Check called. Transitioning to playPhase.");
              events.setPhase('playPhase');
          }
      }
    },
  },
  playerView: ({ G, playerID, ctx }) => {
    const filteredG: any = { ...G }; 

    if (G.deck) {
      filteredG.deck = G.deck.map(() => ({ isHidden: true } as unknown as Card));
    } else {
      filteredG.deck = [];
    }

    filteredG.players = {};
    for (const pID in G.players) {
      if (pID === playerID) {
        if (ctx.phase === 'initialPeekPhase' && ctx.activePlayers?.[playerID] === 'revealingCardsStage') {
          const specificHandReveal = G.players[playerID].hand.map((card, index) => {
            if (index === 2 || index === 3) {
              return card;
            }
            return { isHidden: true } as unknown as Card;
          });
          filteredG.players[pID] = {
            ...G.players[pID],
            hand: specificHandReveal,
          };
        } else {
          filteredG.players[pID] = G.players[pID];
        }
      } else {
        filteredG.players[pID] = {
          ...G.players[pID],
          hand: G.players[pID].hand.map(() => ({ isHidden: true } as unknown as Card)),
          pendingDrawnCard: null,
          pendingDrawnCardSource: null,
        };
      }
    }

    return filteredG;
  },
}; 