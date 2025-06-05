```typescript
import { setup, assign, sendTo, raise, choose } from 'xstate';

// --- Helper Types (Assume these are imported from shared-types or defined elsewhere) ---
type Card = { id: string; suit: string; rank: string; isFaceDownToOwner?: boolean };
type PlayerId = string;
type GamePhase =
  | 'WaitingForPlayers'
  | 'InitialPeekPhase'
  | 'PlayPhase'
  | 'MatchingStage'
  | 'AbilityResolutionPhase'
  | 'FinalTurnsPhase'
  | 'ScoringPhase'
  | 'GameOver';
type TurnSegment = 'initialAction' | 'postDrawAction' | 'abilityAction' | null;

interface PlayerState {
  id: PlayerId;
  hand: Card[];
  isLocked: boolean;
  hasCalledCheck: boolean;
  pendingDrawnCard: Card | null;
  pendingDrawnCardSource: 'deck' | 'discard' | null;
  pendingSpecialAbility: PendingSpecialAbility | null; // More detailed for K/Q
  score: number;
  name: string;
  isConnected: boolean;
  socketId: string;
  forfeited: boolean;
  isReadyForInitialPeek: boolean;
  cardsToPeek: Card[] | null;
  peekAcknowledgeDeadline: number | null;
  numMatches: number;
  numPenalties: number;
  // Timers specific to player if needed, e.g., turnTimerExpiresAt
}

interface MatchingOpportunityInfo {
  cardToMatch: Card;
  originalPlayerID: PlayerId;
  potentialMatchers: PlayerId[]; // IDs of players who can still attempt a match
  actedMatchers: PlayerId[]; // IDs of players who have already acted (matched/failed/passed)
}

interface PendingSpecialAbility {
  playerId: PlayerId;
  card: Card; // The special card (K, Q, J)
  source: 'stack' | 'stackSecondOfPair' | 'discard' | 'deck';
  currentAbilityStage?: 'awaitingTargetSelection' | 'awaitingPeekConfirmation' | 'awaitingSwapConfirmation' | 'peek' | 'swap'; // For K/Q
  peekTargets?: Array<{ playerID: PlayerId; cardIndex: number }>; // For K/Q after peek
  // pairTargetId?: PlayerId; // If needed for LIFO stack identification
}

interface GameContext {
  gameId: string;
  deck: Card[];
  discardPile: Card[];
  players: Record<PlayerId, PlayerState>;
  currentPlayerId: PlayerId | null;
  turnOrder: PlayerId[];
  currentPhase: GamePhase; // Can be derived from machine state, but useful for client
  currentTurnSegment: TurnSegment;
  playerWhoCalledCheck: PlayerId | null;
  finalTurnsTaken: number;
  matchingOpportunityInfo: MatchingOpportunityInfo | null;
  discardPileIsSealed: boolean;
  pendingAbilities: PendingSpecialAbility[]; // Sorted queue for resolution
  lastResolvedAbilityCardForCleanup: Card | null; // For UI effects
  lastResolvedAbilitySource: PendingSpecialAbility['source'] | null;
  globalAbilityTargets: Array<{ playerID: PlayerId; cardIndex: number; type: 'peek' | 'swap' }> | null;
  gameMasterId: PlayerId | null;
  gameSettings: { minPlayers: number; maxPlayers: number; turnDurationMs: number /* etc. */ };
  // Server-side timer IDs (conceptual, XState handles actual timing)
  // activeTurnTimerId: any | null;
  // activeMatchingStageTimerId: any | null;
}

type PlayerActionPayload = {
    handIndex?: number;
    handIndexToDiscard?: number;
    abilityArgs?: { // Detailed structure for K,Q,J args
        skipType?: 'peek' | 'swap' | 'full';
        peekTargets?: Array<{ playerID: PlayerId; cardIndex: number }>;
        swapTargets?: Array<{ playerID: PlayerId; cardIndex: number }>;
    };
};

type GameEvent =
  // Game Setup
  | { type: 'CREATE_GAME'; playerId: PlayerId; name: string; socketId: string; gameSettings: GameContext['gameSettings'] }
  | { type: 'PLAYER_JOINS'; playerId: PlayerId; name: string; socketId: string }
  | { type: 'GAME_START_REQUESTED'; requestingPlayerId: PlayerId }
  // Initial Peek
  | { type: 'PLAYER_DECLARES_READY_FOR_PEEK'; playerId: PlayerId }
  | { type: 'INITIAL_PEEK_TIMER_EXPIRED' } // Or all players declared ready
  // Player Actions
  | { type: 'DRAW_FROM_DECK'; playerId: PlayerId }
  | { type: 'DRAW_FROM_DISCARD'; playerId: PlayerId }
  | { type: 'SWAP_AND_DISCARD'; playerId: PlayerId; payload: PlayerActionPayload }
  | { type: 'DISCARD_DRAWN_CARD'; playerId: PlayerId }
  | { type: 'CALL_CHECK'; playerId: PlayerId }
  // Matching Stage
  | { type: 'ATTEMPT_MATCH'; playerId: PlayerId; payload: PlayerActionPayload }
  | { type: 'PASS_MATCH'; playerId: PlayerId }
  // Ability Resolution
  | { type: 'RESOLVE_SPECIAL_ABILITY'; playerId: PlayerId; payload: PlayerActionPayload }
  // Timers & System Events
  | { type: 'TURN_TIMER_EXPIRED'; timedOutPlayerId: PlayerId }
  | { type: 'MATCHING_STAGE_CONCLUDED' } // Internal event after all acted or timer
  | { type: 'MATCHING_STAGE_TIMER_EXPIRED' }
  | { type: 'ABILITY_RESOLUTION_CONCLUDED'} // Internal event
  | { type: 'ABILITY_ACTION_TIMER_EXPIRED'; playerId: PlayerId }
  | { type: 'PLAYER_DISCONNECTED'; playerId: PlayerId }
  | { type: 'PLAYER_RECONNECTED'; playerId: PlayerId; newSocketId: string }
  | { type: 'DISCONNECT_GRACE_TIMER_EXPIRED'; playerId: PlayerId }
  // Game End
  | { type: 'PLAY_AGAIN_REQUESTED' };


// --- Helper Functions (Conceptual - to be implemented) ---
const createNewPlayer = (id: PlayerId, name: string, socketId: string): PlayerState => ({
  id, name, socketId, hand: [], isLocked: false, hasCalledCheck: false, pendingDrawnCard: null,
  pendingDrawnCardSource: null, pendingSpecialAbility: null, score: 0, isConnected: true, forfeited: false,
  isReadyForInitialPeek: false, cardsToPeek: null, peekAcknowledgeDeadline: null, numMatches: 0, numPenalties: 0,
});
const createDeck = (): Card[] => [/* ...52 cards */];
const shuffleDeck = (deck: Card[]): Card[] => deck; // placeholder
const dealCardsToPlayers = (players: Record<PlayerId, PlayerState>, deck: Card[]): { updatedPlayers: Record<PlayerId, PlayerState>, updatedDeck: Card[] } => ({ updatedPlayers: players, updatedDeck: deck});
const getPlayerForAbility = (pendingAbilities: PendingSpecialAbility[]): PlayerId | null => pendingAbilities.length > 0 ? pendingAbilities[0].playerId : null;
const determineNextPlayerInTurnOrder = (currentPlayerId: PlayerId | null, turnOrder: PlayerId[], players: Record<PlayerId, PlayerState>): PlayerId | null => {
    // Finds next non-locked, non-forfeited player
    return turnOrder.length > 0 ? turnOrder[0] : null; // Simplified
};
const determineNextFinalTurnPlayer = (playerWhoCalledCheck: PlayerId | null, lastPlayer: PlayerId | null, turnOrder: PlayerId[], players: Record<PlayerId, PlayerState>): PlayerId | null => {
    return null; // Complex logic
}


export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    // --- Game Setup ---
    initializeNewGame: assign((_, event) => {
      const ev = event as { type: 'CREATE_GAME'; playerId: PlayerId; name: string; socketId: string; gameSettings: any };
      const initialPlayer = createNewPlayer(ev.playerId, ev.name, ev.socketId);
      return {
        gameId: `game_${Math.random().toString(36).substring(2, 8)}`,
        deck: [], // Will be created on GAME_START
        discardPile: [],
        players: { [ev.playerId]: initialPlayer },
        currentPlayerId: null,
        turnOrder: [ev.playerId],
        currentPhase: 'WaitingForPlayers',
        currentTurnSegment: null,
        playerWhoCalledCheck: null,
        finalTurnsTaken: 0,
        matchingOpportunityInfo: null,
        discardPileIsSealed: false,
        pendingAbilities: [],
        lastResolvedAbilityCardForCleanup: null,
        lastResolvedAbilitySource: null,
        globalAbilityTargets: null,
        gameMasterId: ev.playerId,
        gameSettings: ev.gameSettings,
      };
    }),
    addPlayerToGame: assign({
      players: ({ context, event }) => {
        const ev = event as { type: 'PLAYER_JOINS'; playerId: PlayerId; name: string; socketId: string };
        const newPlayer = createNewPlayer(ev.playerId, ev.name, ev.socketId);
        return { ...context.players, [ev.playerId]: newPlayer };
      },
      turnOrder: ({ context, event }) => [...context.turnOrder, (event as { type: 'PLAYER_JOINS' }).playerId],
    }),
    prepareForGameStart: assign(context => {
      const initialDeck = createDeck();
      const shuffled = shuffleDeck(initialDeck);
      const { updatedPlayers, updatedDeck } = dealCardsToPlayers(context.players, shuffled);
      const firstPlayer = context.turnOrder.length > 0 ? context.turnOrder[0] : null;
      return {
        ...context,
        deck: updatedDeck,
        players: updatedPlayers,
        //currentPlayerId: firstPlayer, // Set when InitialPeekPhase ends
        currentPhase: 'InitialPeekPhase',
        // For each player: players[pId].cardsToPeek = [hand[2], hand[3]]; players[pId].peekAcknowledgeDeadline = Date.now() + PEEK_TIME
      };
    }),
    // --- Initial Peek ---
    markPlayerReadyForPeek: assign({
      players: ({ context, event }) => {
        const ev = event as { type: 'PLAYER_DECLARES_READY_FOR_PEEK' };
        // return { ...context.players, [ev.playerId]: { ...context.players[ev.playerId], isReadyForInitialPeek: true } };
        const updatedPlayer = { ...context.players[ev.playerId], isReadyForInitialPeek: true };
        return {...context.players, [ev.playerId]: updatedPlayer};
      }
    }),
    clearAllPeekInfoAndSetFirstPlayer: assign(context => {
      const updatedPlayers = { ...context.players };
      for (const pId in updatedPlayers) {
        updatedPlayers[pId].cardsToPeek = null;
        updatedPlayers[pId].peekAcknowledgeDeadline = null;
      }
      return {
        ...context,
        players: updatedPlayers,
        currentPlayerId: determineNextPlayerInTurnOrder(null, context.turnOrder, context.players),
        currentPhase: 'PlayPhase',
        currentTurnSegment: 'initialAction',
      };
    }),
    // --- Player Actions ---
    assignPendingCardFromDeck: assign((context, event) => {
        const ev = event as { type: 'DRAW_FROM_DECK', playerId: PlayerId };
        const player = context.players[ev.playerId];
        // const drawnCard = context.deck.pop(); // This mutates, be careful with XState context updates
        const newDeck = [...context.deck];
        const drawnCard = newDeck.pop();
        return {
            ...context,
            deck: newDeck,
            players: {
                ...context.players,
                [ev.playerId]: { ...player, pendingDrawnCard: drawnCard || null, pendingDrawnCardSource: 'deck' }
            },
            currentTurnSegment: 'postDrawAction',
        };
    }),
    assignPendingCardFromDiscard: assign((context, event) => {
        const ev = event as { type: 'DRAW_FROM_DISCARD', playerId: PlayerId };
        // ... similar logic ...
        return { ...context, currentTurnSegment: 'postDrawAction' /* actually mustSwap */ };
    }),
    executeSwapAndDiscard: assign((context, event) => {
        const ev = event as { type: 'SWAP_AND_DISCARD', playerId: PlayerId, payload: PlayerActionPayload };
        // ... logic to swap hand card with pending, move hand card to discardPile ...
        // Set matchingOpportunityInfo
        // Clear pendingDrawnCard
        return { ...context, discardPileIsSealed: false, currentTurnSegment: null };
    }),
    executeDiscardDrawnCard: assign((context, event) => {
        // ... logic to move pendingDrawnCard to discardPile ...
        // Set matchingOpportunityInfo
        // Clear pendingDrawnCard
        return { ...context, discardPileIsSealed: false, currentTurnSegment: null };
    }),
    setCheckCaller: assign((context, event) => {
        const ev = event as { type: 'CALL_CHECK', playerId: PlayerId };
        return {
            ...context,
            playerWhoCalledCheck: ev.playerId,
            finalTurnsTaken: 0,
            players: { ...context.players, [ev.playerId]: { ...context.players[ev.playerId], isLocked: true, hasCalledCheck: true }},
            currentPhase: 'FinalTurnsPhase',
            currentTurnSegment: null,
        };
    }),
    // --- Matching Stage ---
    setupMatchingOpportunity: assign({
        // This would be part of executeSwapAndDiscard or executeDiscardDrawnCard
        // matchingOpportunityInfo: { cardToMatch, originalPlayerID, potentialMatchers: active_non_locked_players }
        // currentPhase: 'MatchingStage'
    }),
    processSuccessfulMatch: assign((context, event) => {
        const ev = event as { type: 'ATTEMPT_MATCH', playerId: PlayerId, payload: PlayerActionPayload };
        // ... update matcher's hand, discardPile, numMatches ...
        // Set discardPileIsSealed = true
        // If special pair: add to context.pendingAbilities
        // If matcher empty hand (auto-check): update player.isLocked, hasCalledCheck. If no one calledCheck yet, set context.playerWhoCalledCheck = matcher.playerId
        // Clear matchingOpportunityInfo
        return { ...context };
    }),
    processFailedMatch: assign((context, event) => {
        const ev = event as { type: 'ATTEMPT_MATCH', playerId: PlayerId, payload: PlayerActionPayload };
        // ... matcher draws penalty, numPenalties++, update matchingOpportunityInfo.actedMatchers ...
        return { ...context };
    }),
    processPassMatch: assign((context, event) => {
        const ev = event as { type: 'PASS_MATCH', playerId: PlayerId };
        // ... update matchingOpportunityInfo.actedMatchers ...
        return { ...context };
    }),
    clearMatchingStageAndSetupAbility: assign((context, event) => {
        // ... if original discard was special, add to pendingAbilities ...
        // Clear matchingOpportunityInfo
        return { ...context, currentPhase: 'AbilityResolutionPhase', currentTurnSegment: 'abilityAction' };
    }),
    clearMatchingStageAndProceed: assign((context, event) => {
        // ... Clear matchingOpportunityInfo ...
        // Determine next player or if final turns continue
        const nextPlayer = determineNextPlayerInTurnOrder(context.currentPlayerId, context.turnOrder, context.players);
        return {
            ...context,
            currentPlayerId: nextPlayer,
            currentPhase: context.playerWhoCalledCheck ? 'FinalTurnsPhase' : 'PlayPhase',
            currentTurnSegment: context.playerWhoCalledCheck ? 'initialAction' : (nextPlayer ? 'initialAction' : null),
        };
    }),
    // --- Ability Resolution ---
    setupForNextAbility: assign(context => {
        const nextAbilityUser = getPlayerForAbility(context.pendingAbilities);
        // Sort context.pendingAbilities (LIFO for stacks)
        return { ...context, currentPlayerId: nextAbilityUser, currentTurnSegment: nextAbilityUser ? 'abilityAction' : null };
    }),
    executeAbility: assign((context, event) => {
        const ev = event as { type: 'RESOLVE_SPECIAL_ABILITY', playerId: PlayerId, payload: PlayerActionPayload };
        const abilityToResolve = context.pendingAbilities[0];
        // ... logic for K, Q, J based on ev.payload.abilityArgs (peek, swap, skip) ...
        // Update player hands, globalAbilityTargets
        // Remove resolved ability from pendingAbilities
        // Set lastResolvedAbilitySource, lastResolvedAbilityCardForCleanup
        return { ...context };
    }),
    fizzleCurrentAbility: assign(context => {
        // ... remove current ability from pendingAbilities, set lastResolved...
        return { ...context };
    }),
    // --- Final Turns ---
    setupNextFinalTurn: assign(context => {
        const nextPlayer = determineNextFinalTurnPlayer(context.playerWhoCalledCheck, context.currentPlayerId, context.turnOrder, context.players);
        return {
            ...context,
            currentPlayerId: nextPlayer,
            finalTurnsTaken: nextPlayer ? context.finalTurnsTaken + 1 : context.finalTurnsTaken,
            currentPhase: nextPlayer ? 'PlayPhase' : 'ScoringPhase', // If no next player, go to scoring
            currentTurnSegment: nextPlayer ? 'initialAction' : null,
        };
    }),
    // --- Scoring & Game Over ---
    calculateFinalScores: assign(context => {
        // ... iterate players, sum card values, find winner ...
        // Set context.gameoverData (hypothetical field)
        return { ...context, currentPhase: 'GameOver', currentTurnSegment: null };
    }),
    resetForNewGame: assign(context => {
        // ... re-initialize context similar to initializeNewGame but keep players/settings
        return { /* ... new game state ... */ };
    }),
    // --- Player Connectivity ---
    markPlayerDisconnected: assign((context, event) => {
      const ev = event as { type: 'PLAYER_DISCONNECTED', playerId: PlayerId };
      // ... set players[ev.playerId].isConnected = false ...
      // conceptually start a grace timer for this player
      return { ...context };
    }),
    markPlayerReconnected: assign((context, event) => {
      const ev = event as { type: 'PLAYER_RECONNECTED', playerId: PlayerId, newSocketId: string };
      // ... set players[ev.playerId].isConnected = true, update socketId ...
      // conceptually clear grace timer
      return { ...context };
    }),
    forfeitDisconnectedPlayer: assign((context, event) => {
      const ev = event as { type: 'DISCONNECT_GRACE_TIMER_EXPIRED', playerId: PlayerId };
      // ... set players[ev.playerId].forfeited = true ...
      return { ...context };
    }),

    // --- Common Actions ---
    startPlayerTurnTimer: (ctx) => console.log('Action: Start turn timer for', ctx.currentPlayerId), // Placeholder
    clearPlayerTurnTimer: (ctx) => console.log('Action: Clear turn timer for', ctx.currentPlayerId), // Placeholder
    startMatchingStageGlobalTimer: () => console.log('Action: Start matching stage timer'), // Placeholder
    clearMatchingStageGlobalTimer: () => console.log('Action: Clear matching stage timer'), // Placeholder
    clearGlobalAbilityVisuals: assign({ globalAbilityTargets: null }),

    logToConsole: (_, event, { state }) => { console.log(`Event: ${event.type}, State: ${JSON.stringify(state.value)}`); }

  },
  guards: {
    // --- Game Setup ---
    isGameMasterRequestingStart: ({ context, event }) => (event as {type: 'GAME_START_REQUESTED'}).requestingPlayerId === context.gameMasterId,
    hasMinimumPlayers: ({ context }) => Object.keys(context.players).length >= context.gameSettings.minPlayers,
    canAddMorePlayers: ({ context }) => Object.keys(context.players).length < context.gameSettings.maxPlayers,
    // --- Initial Peek ---
    areAllPlayersReadyForPeek: ({ context }) => Object.values(context.players).every(p => p.isConnected && !p.forfeited && p.isReadyForInitialPeek),
    // --- Player Actions (General) ---
    isPlayerCurrentTurn: ({ context, event }) => (event as {playerId?: PlayerId}).playerId === context.currentPlayerId,
    isPlayerNotLocked: ({ context, event }) => !context.players[(event as {playerId: PlayerId}).playerId]?.isLocked,
    playerHasNoPendingCard: ({ context, event }) => !context.players[(event as {playerId: PlayerId}).playerId]?.pendingDrawnCard,
    playerHasNoPendingAbility: ({ context, event }) => !context.players[(event as {playerId: PlayerId}).playerId]?.pendingSpecialAbility,
    // --- Draw Actions ---
    isDeckAvailableToDraw: ({ context }) => context.deck.length > 0,
    isDiscardPileAvailableToDraw: ({ context }) => context.discardPile.length > 0 && !context.discardPileIsSealed && (context.discardPile[0]?.rank !== 'K' && context.discardPile[0]?.rank !== 'Q' && context.discardPile[0]?.rank !== 'J'),
    // --- Call Check ---
    canPlayerCallCheck: ({ context, event }) => context.playerWhoCalledCheck === null, // More conditions in combination with above
    // --- Matching ---
    isValidMatchAttempt: ({ context, event }) => {
        // const ev = event as { type: 'ATTEMPT_MATCH', playerId: PlayerId, payload: PlayerActionPayload };
        // Check if ev.playerId is in matchingOpportunityInfo.potentialMatchers
        // Check if card in hand (payload.handIndex) matches rank of matchingOpportunityInfo.cardToMatch
        return true; // Placeholder
    },
    isMatchSuccessful: ({ context, event }) => { /* Placeholder for actual card rank comparison */ return true; },
    isMatchFailure: ({ context, event }) => { /* Placeholder for actual card rank comparison */ return false; },
    isSpecialCardPairMatched: ({ context, event }) => { /* Placeholder: check if both cards in match are K,Q,J */ return false; },
    didMatcherEmptyHandOnMatch: ({ context, event }) => { /* Placeholder */ return false; },
    haveAllPotentialMatchersActed: ({ context }) => {
        // return context.matchingOpportunityInfo?.potentialMatchers.every(pId => context.matchingOpportunityInfo.actedMatchers.includes(pId));
        return context.matchingOpportunityInfo ? context.matchingOpportunityInfo.potentialMatchers.length === 0 : true; // Simplified: if no one left to act
    },
    wasOriginalDiscardSpecialCard: ({ context }) => {
        // const card = context.discardPile[0]; // Assuming it's still there, or from a temp var
        // return card?.rank === 'K' || card?.rank === 'Q' || card?.rank === 'J';
        // Safer: Check the cardToMatch from matchingOpportunityInfo when it was set
        const card = context.matchingOpportunityInfo?.cardToMatch;
        return !!card && (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J');
    },
    // --- Ability Resolution ---
    areAbilitiesInQueue: ({ context }) => context.pendingAbilities.length > 0,
    isCurrentPlayerTheAbilityHolder: ({ context, event }) => context.pendingAbilities.length > 0 && context.pendingAbilities[0].playerId === (event as {playerId: PlayerId}).playerId,
    // --- Final Turns ---
    areAllFinalTurnsCompleted: ({ context }) => {
        const activeNonLockedNonForfeitedPlayers = context.turnOrder.filter(pId =>
            pId !== context.playerWhoCalledCheck &&
            context.players[pId] &&
            !context.players[pId].isLocked &&
            !context.players[pId].forfeited
        );
        return context.finalTurnsTaken >= activeNonLockedNonForfeitedPlayers.length;
    },
    // --- Connectivity ---
    shouldGameEndDueToForfeits: ({ context }) => {
        const activePlayers = Object.values(context.players).filter(p => p.isConnected && !p.forfeited);
        return activePlayers.length < context.gameSettings.minPlayers && Object.keys(context.players).length >= context.gameSettings.minPlayers ; // game started but now too few
    }
  },
}).createMachine(
  {
    id: 'checkGameServer',
    context: ({ input }) => ({ // Allows passing initial settings or gameId if rehydrating
        gameId: `game_${Math.random().toString(36).substring(2, 8)}`,
        deck: [], discardPile: [], players: {}, currentPlayerId: null, turnOrder: [],
        currentPhase: 'WaitingForPlayers', currentTurnSegment: null, playerWhoCalledCheck: null, finalTurnsTaken: 0,
        matchingOpportunityInfo: null, discardPileIsSealed: false, pendingAbilities: [],
        lastResolvedAbilityCardForCleanup: null, lastResolvedAbilitySource: null, globalAbilityTargets: null,
        gameMasterId: null, gameSettings: { minPlayers: 2, maxPlayers: 4, turnDurationMs: 60000 }
    }),
    initial: 'WaitingForPlayers',
    on: { // Global transitions
        PLAYER_DISCONNECTED: { actions: 'markPlayerDisconnected' /* + start grace timer actor */ },
        PLAYER_RECONNECTED: { actions: 'markPlayerReconnected' /* + clear grace timer actor */ },
        DISCONNECT_GRACE_TIMER_EXPIRED: [
            { target: '.ScoringPhase', guard: 'shouldGameEndDueToForfeits', actions: ['forfeitDisconnectedPlayer', 'calculateFinalScores'] },
            { actions: 'forfeitDisconnectedPlayer' /* + if current player, advance turn */ }
        ]
    },
    states: {
      WaitingForPlayers: {
        entry: assign({ currentPhase: (_) => 'WaitingForPlayers'}),
        on: {
          CREATE_GAME: { // Should ideally only happen once to initialize
            actions: 'initializeNewGame',
            // Stays in WaitingForPlayers to allow others to join
          },
          PLAYER_JOINS: {
            guard: 'canAddMorePlayers',
            actions: 'addPlayerToGame',
          },
          GAME_START_REQUESTED: {
            target: 'InitialPeekPhase',
            guard: ({event, context}) =>ጋard('isGameMasterRequestingStart', {event, context}) && guard('hasMinimumPlayers', {event, context}),
            actions: 'prepareForGameStart',
          },
        },
      },
      InitialPeekPhase: {
        entry: [assign({ currentPhase: (_) => 'InitialPeekPhase'}), /* assign cardsToPeek, deadline */ /* conceptually start global peek timer */],
        // Each PLAYER_DECLARES_READY_FOR_PEEK would update context.
        // An internal event or 'always' transition would check if all are ready.
        always: { // Or on specific event like ALL_PLAYERS_READY
            target: 'PlayPhase',
            guard: 'areAllPlayersReadyForPeek',
            actions: ['clearAllPeekInfoAndSetFirstPlayer', 'startPlayerTurnTimer', 'logToConsole'],
        },
        on: {
            PLAYER_DECLARES_READY_FOR_PEEK: {
                actions: ['markPlayerReadyForPeek', 'logToConsole'],
                // This action could also raise an event if all are now ready,
                // or rely on the 'always' transition.
            },
            INITIAL_PEEK_TIMER_EXPIRED: { // Fallback if players don't declare
                target: 'PlayPhase',
                actions: ['clearAllPeekInfoAndSetFirstPlayer', 'startPlayerTurnTimer', 'logToConsole'],
            }
        }
      },
      PlayPhase: {
        entry: [assign({ currentPhase: (_) => 'PlayPhase', currentTurnSegment: 'initialAction' }), 'clearGlobalAbilityVisuals', 'startPlayerTurnTimer', 'logToConsole'],
        exit: ['clearPlayerTurnTimer'],
        initial: 'AwaitingDrawAction',
        states: {
          AwaitingDrawAction: {
            entry: assign({currentTurnSegment: 'initialAction'}),
            on: {
              DRAW_FROM_DECK: {
                target: 'AwaitingDiscardChoice',
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}) && guard('playerHasNoPendingCard', {event, context}) && guard('isDeckAvailableToDraw', {event, context}),
                actions: ['assignPendingCardFromDeck', 'logToConsole'],
              },
              DRAW_FROM_DISCARD: {
                target: 'MustSwapAfterDiscardDraw', // Or a generic PostDrawAction if logic is similar enough
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}) && guard('playerHasNoPendingCard', {event, context}) && guard('isDiscardPileAvailableToDraw', {event, context}),
                actions: ['assignPendingCardFromDiscard', 'logToConsole'],
              },
              CALL_CHECK: {
                target: '#checkGameServer.FinalTurnsPhase',
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}) && guard('playerHasNoPendingCard', {event, context}) && guard('playerHasNoPendingAbility', {event, context}) && guard('canPlayerCallCheck', {event, context}),
                actions: ['setCheckCaller', 'logToConsole'],
              },
            },
          },
          AwaitingDiscardChoice: { // After drawing from deck
            entry: assign({currentTurnSegment: 'postDrawAction'}),
            on: {
              SWAP_AND_DISCARD: {
                target: '#checkGameServer.MatchingStage',
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}), // Add validation for handIndex
                actions: ['executeSwapAndDiscard', 'setupMatchingOpportunity', 'logToConsole'],
              },
              DISCARD_DRAWN_CARD: {
                target: '#checkGameServer.MatchingStage',
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}),
                actions: ['executeDiscardDrawnCard', 'setupMatchingOpportunity', 'logToConsole'],
              },
            },
          },
          MustSwapAfterDiscardDraw: { // After drawing from discard
            entry: assign({currentTurnSegment: 'postDrawAction'}),
            on: {
              SWAP_AND_DISCARD: { // Player MUST swap
                target: '#checkGameServer.MatchingStage',
                guard: ({event, context}) => guard('isPlayerCurrentTurn', {event, context}) && guard('isPlayerNotLocked', {event, context}), // Add validation for handIndex
                actions: ['executeSwapAndDiscard', 'setupMatchingOpportunity', 'logToConsole'],
              },
            },
          },
        },
        on: {
            TURN_TIMER_EXPIRED: { // Handle player turn timeout
                // This needs more sophisticated routing based on current sub-state of PlayPhase
                // For example, if in AwaitingDrawAction, it just skips turn.
                // If in AwaitingDiscardChoice, it auto-discards drawn card.
                target: 'PlayPhase', // Simplified: Go to next player's turn start
                actions: [/* determineTimeoutAction */ 'logToConsole', assign(context => ({
                    currentPlayerId: determineNextPlayerInTurnOrder(context.currentPlayerId, context.turnOrder, context.players),
                    currentPhase: 'PlayPhase', // Stays in play phase for next player
                    currentTurnSegment: 'initialAction',
                })), 'startPlayerTurnTimer'],
            }
        }
      },
      MatchingStage: {
        entry: [assign({ currentPhase: (_) => 'MatchingStage', currentTurnSegment: null }), 'startMatchingStageGlobalTimer', 'logToConsole'],
        exit: ['clearMatchingStageGlobalTimer'],
        // This state needs an internal mechanism or event to signify conclusion
        // For example, after each ATTEMPT_MATCH or PASS_MATCH, check if all acted.
        always: [ // Check if stage should conclude
            { target: 'AbilityResolutionPhase', guard: 'haveAllPotentialMatchersActed', cond: 'wasOriginalDiscardSpecialCard', actions: ['clearMatchingStageAndSetupAbility', 'logToConsole'] },
            { target: 'FinalTurnsPhase', guard: 'haveAllPotentialMatchersActed', cond: ({context}) => !!context.playerWhoCalledCheck, actions: [/* clearMatchingStageAndProceedToFinalTurns */ 'logToConsole', assign(context => ({ // Placeholder direct assignment
                ...context,
                matchingOpportunityInfo: null,
                // currentPlayerId remains the one who discarded, FinalTurnsPhase will pick next
                currentPhase: 'FinalTurnsPhase', currentTurnSegment: 'initialAction',
            }))]},
            { target: 'PlayPhase', guard: 'haveAllPotentialMatchersActed', actions: ['clearMatchingStageAndProceed', 'startPlayerTurnTimer', 'logToConsole'] },
        ],
        on: {
          ATTEMPT_MATCH: [
            { // Successful Match that triggers abilities
              guard: ({event, context}) => guard('isValidMatchAttempt', {event, context}) && guard('isMatchSuccessful', {event, context}) && guard('isSpecialCardPairMatched', {event, context}),
              actions: ['processSuccessfulMatch', 'logToConsole'], // processSuccessfulMatch sets up pendingAbilities
              // 'always' will then transition to AbilityResolutionPhase if pendingAbilities exist
            },
            { // Successful Match that leads to auto-check (no abilities)
              guard: ({event, context}) => guard('isValidMatchAttempt', {event, context}) && guard('isMatchSuccessful', {event, context}) && !guard('isSpecialCardPairMatched', {event, context}) && guard('didMatcherEmptyHandOnMatch', {event, context}),
              actions: ['processSuccessfulMatch', 'logToConsole'], // processSuccessfulMatch handles auto-check logic
               // 'always' might transition to FinalTurnsPhase
            },
            { // Successful Match (normal, no abilities, no auto-check)
              guard: ({event, context}) => guard('isValidMatchAttempt', {event, context}) && guard('isMatchSuccessful', {event, context}), // and not special, not empty hand
              actions: ['processSuccessfulMatch', 'logToConsole'],
              // 'always' transition handles moving to next player in PlayPhase
            },
            { // Failed Match
              guard: ({event, context}) => guard('isValidMatchAttempt', {event, context}) && guard('isMatchFailure', {event, context}),
              actions: ['processFailedMatch', 'logToConsole'],
              // Stays in MatchingStage, re-evaluates 'always'
            },
          ],
          PASS_MATCH: {
            actions: ['processPassMatch', 'logToConsole'],
            // Stays in MatchingStage, re-evaluates 'always'
          },
          MATCHING_STAGE_TIMER_EXPIRED: { // Same transitions as 'always' when all have acted
            // This event forces the 'always' conditions to be re-evaluated after timeout
            actions: 'logToConsole', // The 'always' transitions will handle the rest
          },
        },
      },
      AbilityResolutionPhase: {
        entry: [assign({ currentPhase: (_) => 'AbilityResolutionPhase', currentTurnSegment: 'abilityAction' }), 'setupForNextAbility', /* start ability action timer? */ 'logToConsole'],
        exit: [/* clear ability action timer? */],
        always: [ // Check if abilities are done or player is locked
            { target: 'FinalTurnsPhase', guard: ({context}) => !guard('areAbilitiesInQueue', {context}) && !!context.playerWhoCalledCheck, actions: ['clearGlobalAbilityVisuals', /* setup for final turns (next player) */ 'logToConsole', assign(context => ({...context, currentPhase: 'FinalTurnsPhase', currentTurnSegment: 'initialAction', currentPlayerId: determineNextFinalTurnPlayer(context.playerWhoCalledCheck, context.currentPlayerId, context.turnOrder, context.players) })), 'startPlayerTurnTimer' ]},
            { target: 'PlayPhase', guard: ({context}) => !guard('areAbilitiesInQueue', {context}), actions: ['clearGlobalAbilityVisuals', /* setup for next player */ 'logToConsole', assign(context => ({...context, currentPhase: 'PlayPhase', currentTurnSegment: 'initialAction', currentPlayerId: determineNextPlayerInTurnOrder(context.currentPlayerId, context.turnOrder, context.players) })), 'startPlayerTurnTimer' ]},
            { cond: ({context}) => guard('areAbilitiesInQueue', {context}) && guard('isPlayerLocked', { event: { playerId: context.pendingAbilities[0].playerId } as any, context }), actions: ['fizzleCurrentAbility', 'setupForNextAbility', 'logToConsole'] /* re-enter self via always */ }
        ],
        on: {
          RESOLVE_SPECIAL_ABILITY: {
            guard: 'isCurrentPlayerTheAbilityHolder', // And player not locked
            // The target might be self to re-evaluate 'always' or handle multi-stage abilities (K/Q)
            // For K/Q, 'executeAbility' might change pendingAbilities[0].currentAbilityStage
            actions: ['executeAbility', 'setupForNextAbility', 'logToConsole'], // 'setupForNextAbility' re-sorts and sets currentPlayerId
            // No explicit target, relies on 'always' to transition or re-evaluate current ability state
          },
          ABILITY_ACTION_TIMER_EXPIRED: { // If an ability action times out
            actions: ['fizzleCurrentAbility', 'setupForNextAbility', 'logToConsole'],
          },
        },
      },
      FinalTurnsPhase: {
        entry: [assign({ currentPhase: (_) => 'FinalTurnsPhase'}), 'setupNextFinalTurn', 'startPlayerTurnTimer', 'logToConsole'], // setupNextFinalTurn might transition to Scoring if no one is left
        exit: ['clearPlayerTurnTimer'],
        always: { // If setupNextFinalTurn leads to scoring, it will set phase directly
            target: 'ScoringPhase',
            guard: ({context}) => context.currentPhase === 'ScoringPhase', // Guard to ensure it was set by entry action
        },
        // If setupNextFinalTurn finds a player, currentPhase will be 'PlayPhase' (conceptually)
        // The game flow will go: FinalTurnsPhase (entry) -> sets currentPlayerId for final turn, sets currentPhase to 'PlayPhase' effectively -> PlayPhase machine logic runs for this player ->
        // -> end of that player's turn actions in PlayPhase (or MatchingStage/AbilityRes) should lead back to FinalTurnsPhase for re-evaluation.
        // This makes FinalTurnsPhase more of a controller that dispatches to PlayPhase for the actual turn.
        // To model this cleanly for Stately, one might have FinalTurnsPhase.TakingTurn as a substate which internally invokes/mirrors PlayPhase logic.
        // For this skeleton, we assume the PlayPhase is re-entered.
      },
      ScoringPhase: {
        entry: [assign({ currentPhase: (_) => 'ScoringPhase', currentTurnSegment: null }), 'calculateFinalScores', 'logToConsole'],
        after: {
          1000: { target: 'GameOver', actions: 'logToConsole' }, // Delay for showing scores
        },
      },
      GameOver: {
        entry: [assign({ currentPhase: (_) => 'GameOver'}), 'logToConsole'],
        on: {
          PLAY_AGAIN_REQUESTED: {
            target: 'WaitingForPlayers', // Or a more specific 'ResettingGame' state
            actions: ['resetForNewGame', 'logToConsole'],
          },
        },
      },
    },
  }
);
```
