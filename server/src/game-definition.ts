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
    events.setActivePlayers({ others: 'matchingStage', currentPlayer: 'matchingStage' });
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
    events.setActivePlayers({ others: 'matchingStage', currentPlayer: 'matchingStage' });
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
        if (!G.players[playerID]) G.players[playerID] = { hand: [], hasUsedInitialPeek: false, pendingDrawnCard: null, pendingDrawnCardSource: null, pendingSpecialAbility: null, hasCalledCheck: false, isLocked: false, score: 0 };
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
    if (ctx.phase !== 'matchingStage' && (!ctx.activePlayers || ctx.activePlayers[playerID] !== 'matchingStage')) return 'INVALID_MOVE';
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
    if (!playerID || (ctx.phase !== 'matchingStage' && (!ctx.activePlayers || ctx.activePlayers[playerID] !== 'matchingStage'))) return 'INVALID_MOVE';
    events.endStage();
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
    } as SharedCheckGameState;
  },
  moves: allGameMoves,
  phases: {
    initialPeekPhase: {
      turn: {},
      moves: { performPeek: allGameMoves.performPeek },
      endIf: ({ ctx }) => ctx.turn > ctx.numPlayers,
      next: 'playPhase',
      start: true,
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
      turn: {
        activePlayers: { all: 'stage', moveLimit: 1 },
        onEnd: ({G, ctx, events}) => {
            const originalMatchingInfo = G.matchingOpportunityInfo;
            const cardX = originalMatchingInfo?.cardToMatch;
            const originalDiscarderID = originalMatchingInfo?.originalPlayerID;
            if (G.matchingOpportunityInfo === null && originalMatchingInfo !== null) { 
                let nextPlayerForAbility: string | null = null;
                let abilitySourcePriority: 'stack' | 'stackSecondOfPair' | null = null;
                for (const playerID in G.players) {
                    const playerState = G.players[playerID];
                    if (playerState.pendingSpecialAbility) {
                        if (playerState.pendingSpecialAbility.source === 'stack') {
                            nextPlayerForAbility = playerID; abilitySourcePriority = 'stack'; break;
                        } else if (playerState.pendingSpecialAbility.source === 'stackSecondOfPair' && !abilitySourcePriority) {
                            nextPlayerForAbility = playerID; abilitySourcePriority = 'stackSecondOfPair';
                        }
                    }
                }
                if (nextPlayerForAbility) {
                    events.setActivePlayers({ [nextPlayerForAbility]: 'abilityResolutionStage' }); return;
                }
            } else if (originalMatchingInfo !== null) { 
                G.discardPileIsSealed = false;
                if (cardX && originalDiscarderID && [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank)) {
                    G.players[originalDiscarderID].pendingSpecialAbility = { card: cardX, source: 'discard' };
                    events.setActivePlayers({ [originalDiscarderID]: 'abilityResolutionStage' });
                    G.matchingOpportunityInfo = null; return;
                }
            }
            G.matchingOpportunityInfo = null;
            events.endStage();
        }
      }
    },
    abilityResolutionStage: {
      moves: { resolveSpecialAbility: allGameMoves.resolveSpecialAbility },
      turn: { /* activePlayers set by transition */ },
      onEnd: ({G, ctx, events}) => {
          const resolvedPlayerID = ctx.currentPlayer;
          const lastSource = G.lastResolvedAbilitySource;
          G.lastResolvedAbilitySource = null;
          let nextStageTransitioned = false;
          if (G.players[resolvedPlayerID]?.pendingSpecialAbility) { /* Warn unresolved */ }
          if (lastSource === 'stack') {
              let playerX_ID: string | null = null;
              for (const pID in G.players) {
                  if (G.players[pID]?.pendingSpecialAbility?.source === 'stackSecondOfPair') { playerX_ID = pID; break; }
              }
              if (playerX_ID) {
                  events.setActivePlayers({ [playerX_ID]: 'abilityResolutionStage' });
                  nextStageTransitioned = true;
              }
          }
          if (!nextStageTransitioned && G.playerWhoCalledCheck) {
              events.setPhase('finalTurnsPhase');
              nextStageTransitioned = true;
          }
          if (!nextStageTransitioned) events.endStage();
      }
    },
  },
  playerView: ({ G, playerID, ctx }) => {
    if (!playerID) return G;
    const filteredG: any = { ...G };
    delete filteredG.deck;
    filteredG.players = {};
    for (const pID in G.players) {
      if (pID === playerID) {
        filteredG.players[pID] = G.players[pID];
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