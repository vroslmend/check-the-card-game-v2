import moduleAlias from 'module-alias';
import path from 'path';

// Correct path for runtime: from server/dist to shared-types/dist/index.js
const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');

moduleAlias.addAlias('shared-types', sharedTypesPath);
// Ensure this is done before any other imports that might use the alias

import { Server } from 'boardgame.io/server';
import { Game, type Ctx } from 'boardgame.io';
import { Card, Suit, Rank, PlayerState, CheckGameState as SharedCheckGameState, cardValues } from 'shared-types';

console.log('Server starting...');

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
  // --- NEW MOVES FOR MAIN PLAY PHASE ---
  drawFromDeck: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    if (player.pendingDrawnCard || player.pendingSpecialAbility) return; // Must resolve previous draw or ability first
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
    if (player.pendingDrawnCard) return; // Must resolve previous draw first
    if (G.discardPile.length === 0) return;
    if (G.discardPileIsSealed) return; // Cannot draw if sealed

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
    // G.discardPileIsSealed = false; // A single discard unseals it

    // Instead of old logic, set up matching opportunity
    G.matchingOpportunityInfo = {
      cardToMatch: discardedCard,
      originalPlayerID: playerID,
    };
    events.setActivePlayers({ others: 'matchingStage', currentPlayer: 'matchingStage' }); 
    // Or events.setStage('matchingStage'); - depends on how matchingStage is defined
    
    // player.pendingDrawnCard = null; <--- Moved up
    // player.pendingDrawnCardSource = null; <--- Moved up
  },
  discardDrawnCard: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any, ctx: Ctx }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (player.pendingDrawnCardSource !== 'deck') return; // Can only discard if drawn from deck
    
    const discardedCard = player.pendingDrawnCard;
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;

    G.discardPile.push(discardedCard);
    // G.discardPileIsSealed = false; // A single discard unseals it

    // Instead of old logic, set up matching opportunity
    G.matchingOpportunityInfo = {
      cardToMatch: discardedCard,
      originalPlayerID: playerID,
    };
    events.setActivePlayers({ others: 'matchingStage', currentPlayer: 'matchingStage' });
    // Or events.setStage('matchingStage');

    // player.pendingDrawnCard = null; <--- Moved up
    // player.pendingDrawnCardSource = null; <--- Moved up
  },
  resolveSpecialAbility: ({ G, playerID, events }: { G: SharedCheckGameState; playerID?: string; events: any }, abilityArgs?: any) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingSpecialAbility) return;
    
    const { card } = player.pendingSpecialAbility;
    // Ability logic
    if (card.rank === Rank.King) {
      // King: Peek at any two cards, then swap any two cards
      if (!abilityArgs || !abilityArgs.peekTargets || abilityArgs.peekTargets.length !== 2 || !abilityArgs.swapA || !abilityArgs.swapB) return;
      // Peeking is a client-side effect; server just validates
      // Swap
      const a = G.players[abilityArgs.swapA.playerID]?.hand[abilityArgs.swapA.cardIndex];
      const b = G.players[abilityArgs.swapB.playerID]?.hand[abilityArgs.swapB.cardIndex];
      if (a === undefined || b === undefined) return;
      G.players[abilityArgs.swapA.playerID].hand[abilityArgs.swapA.cardIndex] = b;
      G.players[abilityArgs.swapB.playerID].hand[abilityArgs.swapB.cardIndex] = a;
    } else if (card.rank === Rank.Queen) {
      // Queen: Peek at any one card, then swap any two cards
      if (!abilityArgs || !abilityArgs.peekTargets || abilityArgs.peekTargets.length !== 1 || !abilityArgs.swapA || !abilityArgs.swapB) return;
      // Peeking is a client-side effect; server just validates
      // Swap
      const a = G.players[abilityArgs.swapA.playerID]?.hand[abilityArgs.swapA.cardIndex];
      const b = G.players[abilityArgs.swapB.playerID]?.hand[abilityArgs.swapB.cardIndex];
      if (a === undefined || b === undefined) return;
      G.players[abilityArgs.swapA.playerID].hand[abilityArgs.swapA.cardIndex] = b;
      G.players[abilityArgs.swapB.playerID].hand[abilityArgs.swapB.cardIndex] = a;
    } else if (card.rank === Rank.Jack) {
      // Jack: Swap any two cards
      if (!abilityArgs || !abilityArgs.swapA || !abilityArgs.swapB) return;
      const a = G.players[abilityArgs.swapA.playerID]?.hand[abilityArgs.swapA.cardIndex];
      const b = G.players[abilityArgs.swapB.playerID]?.hand[abilityArgs.swapB.cardIndex];
      if (a === undefined || b === undefined) return;
      G.players[abilityArgs.swapA.playerID].hand[abilityArgs.swapA.cardIndex] = b;
      G.players[abilityArgs.swapB.playerID].hand[abilityArgs.swapB.cardIndex] = a;
    } else {
      // Not a special card
      return;
    }
    // After resolving ability
    G.discardPile.push(card);
    G.lastResolvedAbilitySource = player.pendingSpecialAbility.source; // Store source before nullifying
    player.pendingSpecialAbility = null;
    
    // When called from abilityResolutionStage, this should end the player's turn *within the stage*.
    // The stage's onEnd will then decide what happens next (e.g., resolve another ability or end the stage).
    events.endStage(); // Changed from events.endTurn()
  },
  // --- EXISTING MOVES ---
  drawCard: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }) => {
    if (!playerID) {
      console.error('drawCard called without playerID');
      return;
    }
    if (G.deck.length > 0) {
      const card = G.deck.pop();
      if (card) {
        if (!G.players[playerID]) {
          G.players[playerID] = { hand: [], hasUsedInitialPeek: false };
        }
        G.players[playerID].hand.push(card);
      }
    } else {
      console.warn('Deck is empty for player ' + playerID + ', cannot draw card.');
    }
  },

  performPeek: ({ G, playerID }: { G: SharedCheckGameState; playerID?: string }, cardIndices: number[]) => {
    if (!playerID || !G.players[playerID]) {
      console.error('performPeek: Invalid playerID or player not found.');
      return; 
    }
    if (G.players[playerID].hasUsedInitialPeek) {
      console.warn(`Player ${playerID} has already used their initial peek.`);
      return; 
    }
    if (G.players[playerID].hand.length < 2) {
      console.warn(`Player ${playerID} does not have enough cards to peek at (needs at least 2).`);
      return;
    }
    G.players[playerID].hasUsedInitialPeek = true;
    // Peeking does not end the turn. It's an action within the initialPeekPhase turn.
  },

  // Renamed from attemptQuickAction, to be implemented for matchingStage
  attemptMatch: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }, handIndex: number) => {
    if (!playerID) return 'INVALID_MOVE';
    const player = G.players[playerID];
    if (!player) return 'INVALID_MOVE';
    if (handIndex < 0 || handIndex >= player.hand.length) return 'INVALID_MOVE';

    if (ctx.phase !== 'matchingStage' && (!ctx.activePlayers || ctx.activePlayers[playerID] !== 'matchingStage')) {
      console.log("attemptMatch called outside of matchingStage or by inactive player.");
      return 'INVALID_MOVE';
    }
    
    const { cardToMatch, originalPlayerID } = G.matchingOpportunityInfo || {};
    if (!cardToMatch || !originalPlayerID) {
      console.error("attemptMatch: No matching opportunity available.");
      return 'INVALID_MOVE';
    }

    const cardY = player.hand[handIndex]; // The card played by the current player (matcher)
    const cardX = cardToMatch;             // The card originally discarded, now being matched against

    if (cardY.rank === cardX.rank) {
      console.log(`Player ${playerID} successfully matched ${cardY.rank} with ${cardX.rank}`);
      // 1. Update player's hand (remove cardY)
      player.hand.splice(handIndex, 1);
      // 2. Add cardY to discardPile (on top of cardX)
      G.discardPile.push(cardY);
      // 3. Set discardPileIsSealed = true
      G.discardPileIsSealed = true;

      // 4. Handle auto-check if matcher's hand is empty
      if (player.hand.length === 0) {
        console.log(`Player ${playerID} emptied their hand by matching and calls Check.`);
        player.hasCalledCheck = true;
        player.isLocked = true;
        if (!G.playerWhoCalledCheck) { 
          G.playerWhoCalledCheck = playerID;
        }
        G.finalTurnsTaken = 0; 
        // Important: Clear matching opportunity before changing phase
        G.matchingOpportunityInfo = null;
        events.setPhase('finalTurnsPhase');
        // No further action in this move if phase changes.
        return; // Exit move explicitly
      }

      // 5. Special Card Matched Pair (LIFO abilities)
      const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardX.rank);
      const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardY.rank);

      if (isCardXSpecial && isCardYSpecial) { // Both are special and of same rank
        console.log(`Special pair matched: ${cardY.rank} on ${cardX.rank}. Setting up LIFO abilities.`);
        // Y's ability (matcher) first, then X's ability (original discarder)
        player.pendingSpecialAbility = { card: cardY, source: 'stack' }; // Matcher's card (Y)
        
        if (G.players[originalPlayerID]) {
          // Set pending ability for the original discarder (owner of Card X)
          // It will be resolved *after* cardY's ability.
          G.players[originalPlayerID].pendingSpecialAbility = { card: cardX, source: 'stackSecondOfPair' }; 
        } else {
            console.error(`Original discarder ${originalPlayerID} not found in G.players`);
        }
        // The abilityResolutionStage will need to identify who goes first (Y) then second (X).
      }
      
      // 6. Clear matching opportunity info - this signals a successful match occurred.
      G.matchingOpportunityInfo = null; 
      events.endStage(); // Or events.pass() - lets boardgame.io handle ending player's participation in stage

    } else {
      console.log(`Player ${playerID} failed to match ${cardY.rank} with ${cardX.rank}. Invalid move.`);
      return 'INVALID_MOVE'; // Failed match attempt
    }
  },

  passMatch: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    if (!playerID) return 'INVALID_MOVE';
    if (ctx.phase !== 'matchingStage' && (!ctx.activePlayers || ctx.activePlayers[playerID] !== 'matchingStage')) {
      console.log("passMatch called outside of matchingStage or by inactive player.");
      return 'INVALID_MOVE';
    }
    console.log(`Player ${playerID} passes the matching opportunity.`);
    // Simply end this player's turn in the stage. 
    // The matchingStage.onEnd will determine if the opportunity is over for everyone.
    events.endStage(); // Or events.pass() depending on desired activePlayers flow for stages like this
  },

  callCheck: ({ G, playerID, events, ctx }: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;

    // Conditions for calling Check:
    // 1. Must be the player's turn.
    // 2. Player must not have already called Check.
    // 3. Player must not have a pending drawn card or special ability.
    // 4. Game must be in playPhase (or a phase where Check is allowed).
    if (ctx.currentPlayer !== playerID) return; // Not player's turn
    if (player.hasCalledCheck) return; // Already called Check
    if (player.pendingDrawnCard || player.pendingSpecialAbility) return; // Must resolve pending actions
    if (ctx.phase !== 'playPhase') return; // Can only call Check during playPhase (for now)

    player.hasCalledCheck = true;
    player.isLocked = true;
    if (!G.playerWhoCalledCheck) {
      G.playerWhoCalledCheck = playerID;
    }
    G.finalTurnsTaken = 0; // Reset for the start of final turns
    
    // End the current player's turn and move to the final turns phase
    events.endTurn(); // End current player's turn first
    events.setPhase('finalTurnsPhase'); 
  },
};

const CheckGame: Game<SharedCheckGameState> = {
  name: 'Check',

  setup: ({ ctx, random } : { ctx: Ctx, random: { Die: (sides: number) => number; Shuffle: <T>(deck: T[]) => T[]; [key: string]: any; } }) => {
    const numPlayers = ctx.numPlayers;
    const deck = createDeck();
    const shuffledDeck = random.Shuffle(deck) as Card[]; // Ensure type after shuffle

    const initialPlayers: { [playerID: string]: PlayerState } = {};
    for (let i = 0; i < numPlayers; i++) {
      const playerID = i.toString();
      initialPlayers[playerID] = {
        hand: shuffledDeck.splice(0, 4), // Deal 4 cards
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

  // --- PHASES --- 
  phases: {
    initialPeekPhase: {
      turn: {
        // Default turn order will be used.
      },
      moves: {
        performPeek: allGameMoves.performPeek,
      },
      endIf: (context: { G: SharedCheckGameState, ctx: Ctx }) => { 
        return context.ctx.turn > context.ctx.numPlayers; 
      },
      next: 'playPhase',
      start: true, 
    },
    playPhase: {
      turn: {
        // Default turn order. 
      },
      moves: {
        drawFromDeck: allGameMoves.drawFromDeck,
        drawFromDiscard: allGameMoves.drawFromDiscard,
        swapAndDiscard: allGameMoves.swapAndDiscard,
        discardDrawnCard: allGameMoves.discardDrawnCard,
        resolveSpecialAbility: allGameMoves.resolveSpecialAbility,
        callCheck: allGameMoves.callCheck,
      },
      onBegin: ({ G, ctx, events }: { G: SharedCheckGameState; ctx: Ctx; events: any }) => {
        // Default turn order. 
      },
      onEnd: ({ G, ctx, events }: { G: SharedCheckGameState; ctx: Ctx; events: any }) => {
        // This onEnd might need to be conditional if a matchingStage is active
        console.log(`Turn ended for player ${ctx.currentPlayer} in playPhase.`);

        // If a matching opportunity was just set up, don't end turn here.
        // The turn will end after the matchingStage or ability resolution stage.
        if (G.matchingOpportunityInfo) {
          return; // Wait for matchingStage to resolve
        }
        
        // If a special ability is pending for the current player, don't end turn.
        // (This might be better handled by stages for abilities)
        const currentPlayerState = G.players[ctx.currentPlayer];
        if (currentPlayerState && currentPlayerState.pendingSpecialAbility) {
          console.log(`Player ${ctx.currentPlayer} has a pending special ability. Turn not fully ended.`);
          return; 
        }

        // events.endTurn(); // This is often implicitly handled or handled by stages
      },
    },
    finalTurnsPhase: {
      turn: {
        // Simplified turn order: boardgame.io will cycle through players.
        // The onBegin and onEnd hooks will manage skipping and counting.
        order: { // Default order is usually fine, onBegin handles skips
          first: ({ ctx }: { G: SharedCheckGameState; ctx: Ctx }) => ctx.playOrderPos,
          next: ({ ctx }: { G: SharedCheckGameState; ctx: Ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },
        onBegin: ({ G, ctx, events }: { G: SharedCheckGameState; ctx: Ctx; events: any }) => {
          const currentPlayerState = G.players[ctx.currentPlayer];
          // Skip turn if player is locked OR is the one who originally called Check (their turn is done)
          if (currentPlayerState.isLocked || ctx.currentPlayer === G.playerWhoCalledCheck) {
            events.endTurn(); 
          }
        },
        onEnd: ({ G, ctx, events }: { G: SharedCheckGameState; ctx: Ctx; events: any}) => {
          const playerWhoseTurnEnded = ctx.currentPlayer; // Corrected: Use ctx.currentPlayer

          // If this player is not the one who originally called check,
          // and they weren't already locked (which onBegin would have skipped, but they might have become locked *during* this turn)
          // then count their turn as one of the final turns taken.
          if (playerWhoseTurnEnded && playerWhoseTurnEnded !== G.playerWhoCalledCheck) {
            // We only increment if they weren't the one who called check.
            // The purpose of finalTurnsTaken is to count the *other* players' turns.
            if (G.finalTurnsTaken === undefined) G.finalTurnsTaken = 0;
            // Ensure not to increment if this player was skipped by onBegin or became locked and ended turn prematurely without action
            // This check might need to be more robust: only increment if the turn was productive / not skipped.
            // For now, if onBegin didn't skip them, their turn ending counts.
            G.finalTurnsTaken++;
            console.log(`Player ${playerWhoseTurnEnded} ended final turn. Final turns taken: ${G.finalTurnsTaken}`);
          }
        },
      },
      moves: { // Moves are guarded internally by checking player.isLocked
        drawFromDeck: (context: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
          const { G, playerID } = context;
          if (playerID && G.players[playerID]?.isLocked) return;
          allGameMoves.drawFromDeck(context);
        },
        drawFromDiscard: (context: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
          const { G, playerID } = context;
          if (playerID && G.players[playerID]?.isLocked) return;
          allGameMoves.drawFromDiscard(context);
        },
        swapAndDiscard: (context: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }, handIndex: number) => {
          const { G, playerID } = context;
          if (playerID && G.players[playerID]?.isLocked) return;
          allGameMoves.swapAndDiscard(context, handIndex);
        },
        discardDrawnCard: (context: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }) => {
          const { G, playerID } = context;
          if (playerID && G.players[playerID]?.isLocked) return;
          allGameMoves.discardDrawnCard(context);
        },
        resolveSpecialAbility: (context: { G: SharedCheckGameState; playerID?: string; events: any; ctx: Ctx }, abilityArgs?: any) => {
          const { G, playerID } = context;
          if (playerID && G.players[playerID]?.isLocked && G.players[playerID]?.pendingSpecialAbility) {
            // Allow resolving an ability if it was pending BEFORE lock
          } else if (playerID && G.players[playerID]?.isLocked) return;
          allGameMoves.resolveSpecialAbility(context, abilityArgs);
        },
        attemptMatch: allGameMoves.attemptMatch,
      },
      endIf: ({ G, ctx }: { G: SharedCheckGameState; ctx: Ctx }) => {
        if (G.finalTurnsTaken === undefined) G.finalTurnsTaken = 0; // Defensive
        const expectedFinalTurns = ctx.numPlayers - 1;
        
        // Ensure playerWhoCalledCheck is valid before proceeding
        if (!G.playerWhoCalledCheck) {
          // This case should ideally not be reached if phase started correctly
          console.warn("finalTurnsPhase endIf: playerWhoCalledCheck is not set!");
          return false; 
        }

        if (expectedFinalTurns <= 0) { // Handles 1-player games or if numPlayers is unexpectedly low
            console.log("finalTurnsPhase: No other players for final turns or 1 player game.");
            return { next: 'scoringPhase' };
        }

        if (G.finalTurnsTaken >= expectedFinalTurns) {
          console.log(`finalTurnsPhase ended. Turns taken: ${G.finalTurnsTaken}, Expected: ${expectedFinalTurns}`);
          return { next: 'scoringPhase' };
        }
        return false; 
      },
      next: 'scoringPhase',
    },
    scoringPhase: {
      onBegin: ({ G, ctx, events }: {G: SharedCheckGameState, ctx: Ctx, events: any}) => {
        console.log("Entering scoring phase...");
        let roundWinnerID: string | null = null;
        let lowestScore = Infinity;

        for (const playerID in G.players) {
          const player = G.players[playerID];
          let currentHandScore = 0;
          player.hand.forEach(card => {
            currentHandScore += cardValues[card.rank];
          });
          player.score = currentHandScore;
          console.log(`Player ${playerID} score: ${player.score}`);

          if (player.score < lowestScore) {
            lowestScore = player.score;
            roundWinnerID = playerID;
          } else if (player.score === lowestScore) {
            // Handle ties, e.g. multiple winners or specific tie-breaking rules
            // For now, a simple tie means multiple players could be considered winners
            if (roundWinnerID) {
                roundWinnerID += `, ${playerID}`; // Append to existing winner(s)
            } else {
                roundWinnerID = playerID; // First one in a potential tie
            }
          }
        }
        G.roundWinner = roundWinnerID;
        console.log(`Round winner(s): ${G.roundWinner} with score: ${lowestScore}`);
        
        // For now, the game ends after one round of scoring.
        // This can be changed to setup a new round.
        events.endGame({ winner: G.roundWinner, scores: G.players }); // Pass winner data and scores to endGame
      },
      // No moves in scoring phase by default
      // Players' hands are implicitly revealed by having scores calculated from G.players[playerID].hand
      // To explicitly mark hands as revealed for client, add a flag to PlayerState or CheckGameState
      // `next` is not needed here if events.endGame() is called.
      // If we wanted to loop to another round, we would set `next: 'setup'` (or a new round phase)
    },
    matchingStage: {
      moves: {
        attemptMatch: allGameMoves.attemptMatch,
        passMatch: allGameMoves.passMatch,
      },
      turn: {
        activePlayers: { all: 'stage', moveLimit: 1 }, // Any player can make one move (attemptMatch or pass)
        onBegin: ({G, ctx, events}: {G: SharedCheckGameState, ctx: Ctx, events: any}) => { 
            console.log(`matchingStage begins. Card to match: ${G.matchingOpportunityInfo?.cardToMatch?.rank}. Original discarder: ${G.matchingOpportunityInfo?.originalPlayerID}. Current player (ctx): ${ctx.currentPlayer}`);
        },
        onEnd: ({G, ctx, events}: {G: SharedCheckGameState, ctx: Ctx, events: any}) => {
            const originalMatchingInfo = G.matchingOpportunityInfo; // Capture before attemptMatch potentially clears it
            const cardX = originalMatchingInfo?.cardToMatch;
            const originalDiscarderID = originalMatchingInfo?.originalPlayerID;

            // This onEnd is called after each player in the stage takes their action (attemptMatch or passMatch) OR if the stage ends due to a limit.
            // Since moveLimit is 1, and activePlayers is {all: 'stage'}, this will run after ONE player acts.
            // The key is that attemptMatch *clears* G.matchingOpportunityInfo on a SUCCESSFUL match.

            if (G.matchingOpportunityInfo === null && originalMatchingInfo !== null) { 
                // A successful match was made by the player whose action just ended this stage turn.
                // attemptMatch would have set G.discardPileIsSealed = true and handled auto-Check.
                // It also sets pendingSpecialAbility for matcher (Y) and original discarder (X) if it was a special pair.
                console.log(`Match was successful. Checking for pending abilities.`);

                let nextPlayerForAbility: string | null = null;
                let abilitySourcePriority: 'stack' | 'stackSecondOfPair' | null = null;

                // Check all players for pending abilities that might have been set by attemptMatch
                for (const playerID in G.players) {
                    const playerState = G.players[playerID];
                    if (playerState.pendingSpecialAbility) {
                        if (playerState.pendingSpecialAbility.source === 'stack') { // Card Y ability (matcher)
                            nextPlayerForAbility = playerID;
                            abilitySourcePriority = 'stack';
                            break; // Highest priority
                        } else if (playerState.pendingSpecialAbility.source === 'stackSecondOfPair' && !abilitySourcePriority) { // Card X ability (original discarder)
                            nextPlayerForAbility = playerID;
                            abilitySourcePriority = 'stackSecondOfPair';
                            // Don't break, keep looking for 'stack' source just in case logic changes
                        }
                    }
                }
                
                if (nextPlayerForAbility) {
                    console.log(`Transitioning to abilityResolutionStage for player ${nextPlayerForAbility} (ability: ${abilitySourcePriority}).`);
                    // It's important that abilityResolutionStage is set up to handle the LIFO order if both are set.
                    events.setActivePlayers({ player: nextPlayerForAbility, stage: 'abilityResolutionStage' });
                    // G.matchingOpportunityInfo is already null from attemptMatch
                    return; // End matchingStage processing here
                } else {
                    console.log('Match successful, no special abilities to resolve immediately.');
                    // Match occurred, no special abilities. Original discarder's turn action is complete.
                    // Fall through to end the stage and let playPhase continue (likely ending original discarder's turn).
                }

            } else if (originalMatchingInfo !== null) { 
                // G.matchingOpportunityInfo is STILL NOT NULL. This means the current player passed or their attemptMatch was an INVALID_MOVE.
                // The opportunity is still open for other players if the stage's activePlayers config allows.
                // With { all: 'stage', moveLimit: 1 }, this onEnd gets called after EACH player. 
                // The stage only truly ends when all players have taken their (one) move or passed.
                // So, if we are here, it means one player passed/failed, but the *overall opportunity* might not be over yet.
                // Boardgame.io should handle cycling through players for the stage.
                // This onEnd might then be re-evaluated when the *stage* itself is set to end by boardgame.io.
                // For simplicity, let's assume this onEnd is the *final* onEnd for the stage for now.
                // If it's the true end of the stage and matchingOpportunityInfo is still set, it means NO ONE matched.
                console.log(`No match made (or current player passed/failed). Card X: ${cardX?.rank}. Original discarder: ${originalDiscarderID}`);
                G.discardPileIsSealed = false; // Unseal if no successful match occurred for the whole opportunity.

                if (cardX && originalDiscarderID && (cardX.rank === Rank.King || cardX.rank === Rank.Queen || cardX.rank === Rank.Jack)) {
                    console.log(`Card ${cardX.rank} is special. Setting pending ability for original discarder ${originalDiscarderID}.`);
                    G.players[originalDiscarderID].pendingSpecialAbility = {
                        card: cardX,
                        source: 'discard', 
                    };
                    events.setActivePlayers({ player: originalDiscarderID, stage: 'abilityResolutionStage' });
                    G.matchingOpportunityInfo = null; // Clear opportunity as it's now handled (ability or nothing)
                    return; // End matchingStage processing here
                }
            }
            
            console.log("Ending matchingStage. No further immediate actions (no match or no abilities from match).");
            G.matchingOpportunityInfo = null; // Ensure it's cleared if not already.
            events.endStage();
            // Control returns to playPhase. The original discarder's turn might end, or they might continue if they had other actions.
            // This depends on how playPhase.turn.onEnd and the overall turn flow is structured post-stage.
        }
      }
    },
    abilityResolutionStage: {
      moves: { 
        resolveSpecialAbility: allGameMoves.resolveSpecialAbility 
      },
      turn: {
        activePlayers: { // This will be set by the stage transition (e.g., events.setActivePlayers({player: X, stage: 'abilityResolutionStage'}) )
          // If a single player is set, they become ctx.currentPlayer
        },
        onBegin: ({G, ctx, events}: {G: SharedCheckGameState, ctx: Ctx, events:any}) => {
            const playerID = ctx.currentPlayer; 
            const playerState = G.players[playerID];
            if (!playerState || !playerState.pendingSpecialAbility) { 
                console.error(`Player ${playerID} is in abilityResolutionStage without a valid state or pendingSpecialAbility.`);
                events.endStage(); 
                return;
            }
            console.log(`abilityResolutionStage: Player ${playerID} to resolve ${playerState.pendingSpecialAbility.card.rank} (source: ${playerState.pendingSpecialAbility.source})`);
        },
        onEnd: ({G, ctx, events}: {G: SharedCheckGameState, ctx: Ctx, events:any}) => {
            const resolvedPlayerID = ctx.currentPlayer; 
            const lastSource = G.lastResolvedAbilitySource;
            G.lastResolvedAbilitySource = null; // Clear it after reading

            if (G.players[resolvedPlayerID]?.pendingSpecialAbility) {
                console.warn(`Player ${resolvedPlayerID} ended turn in abilityResolutionStage, but pendingSpecialAbility is still set. Ability not properly resolved by move?`);
                // This might indicate an issue with resolveSpecialAbility move not clearing it, or player escaping the move.
            }

            if (lastSource === 'stack') { // Card Y (matcher's card) was just resolved
                let playerX_ID: string | null = null;
                for (const playerID in G.players) {
                    if (G.players[playerID]?.pendingSpecialAbility?.source === 'stackSecondOfPair') {
                        playerX_ID = playerID;
                        break;
                    }
                }
                if (playerX_ID) {
                    console.log(`Ability from source 'stack' resolved. Transitioning to player ${playerX_ID} for 'stackSecondOfPair' ability.`);
                    events.setActivePlayers({ player: playerX_ID, stage: 'abilityResolutionStage' });
                    return; // Stay in abilityResolutionStage for the next player
                } else {
                    console.log("Ability from source 'stack' resolved. No 'stackSecondOfPair' found. Ending stage.");
                }
            } else if (lastSource === 'discard' || lastSource === 'stackSecondOfPair') {
                console.log(`Ability from source '${lastSource}' resolved. This is the end of this ability sequence. Ending stage.`);
            } else if (lastSource) {
                console.warn(`Ability resolved with unexpected source '${lastSource}'. Ending stage.`);
            } else {
                console.log("abilityResolutionStage.onEnd: No lastResolvedAbilitySource found. Likely ability was not resolved or first turn. Ending stage.");
            }
            
            events.endStage(); // Default action: end the stage
        }
      }
    },
  },
  // --- END PHASES ---

};

const server = Server({ 
  games: [CheckGame],
  origins: ['http://localhost:3000'] // Allow frontend dev server to connect
});
const PORT = parseInt(process.env.PORT || '8000', 10);
server.run(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
