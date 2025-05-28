import moduleAlias from 'module-alias';
import path from 'path';

// Correct path for runtime: from server/dist to shared-types/dist/index.js
const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');

moduleAlias.addAlias('shared-types', sharedTypesPath);
// Ensure this is done before any other imports that might use the alias

import { Server } from 'boardgame.io/server';
import { Game, type Ctx } from 'boardgame.io';
import { Card, Suit, Rank, PlayerState, CheckGameState as SharedCheckGameState } from 'shared-types';

console.log('Server starting...');

// Local CheckGameState, ensure it mirrors shared-types or import directly if resolution is solid
export interface CheckGameState {
  deck: Card[];
  players: { [playerID: string]: PlayerState };
  discardPile: Card[];
  specialAbilityStack?: { card: Card; playerID: string }[];
  stackActive?: boolean;
  quickActionWindow?: {
    active: boolean;
    startTime: number;
    duration: number;
    topCard?: Card;
  };
}

// And update the local PlayerState if needed
interface LocalPlayerState {
  hand: Card[];
  hasUsedInitialPeek: boolean;
  pendingDrawnCard?: Card | null;
  pendingDrawnCardSource?: 'deck' | 'discard' | null;
  pendingSpecialAbility?: {
    card: Card;
    source: 'draw' | 'discard' | 'stack';
  } | null;
}

// Helper function to check if the quick action window is still open
const isQuickActionWindowOpen = (G: CheckGameState): boolean => {
  if (!G.quickActionWindow?.active) return false;
  const now = Date.now();
  return now - G.quickActionWindow.startTime < G.quickActionWindow.duration;
};

// Helper function to open a quick action window
const openQuickActionWindow = (G: CheckGameState, topCard: Card) => {
  G.quickActionWindow = {
    active: true,
    startTime: Date.now(),
    duration: 5000, // 5 seconds window for quick actions
    topCard
  };
};

// Helper function to close the quick action window
const closeQuickActionWindow = (G: CheckGameState) => {
  if (G.quickActionWindow) {
    G.quickActionWindow.active = false;
  }
};

// Define all game moves in a separate object
const allGameMoves = {
  // --- NEW MOVES FOR MAIN PLAY PHASE ---
  drawFromDeck: ({ G, playerID }: { G: CheckGameState; playerID?: string }) => {
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
  drawFromDiscard: ({ G, playerID }: { G: CheckGameState; playerID?: string }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    if (player.pendingDrawnCard) return; // Must resolve previous draw first
    if (G.discardPile.length === 0) return;
    const card = G.discardPile.pop();
    if (!card) return;
    player.pendingDrawnCard = card;
    player.pendingDrawnCardSource = 'discard';
  },
  swapAndDiscard: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }, handIndex: number) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (handIndex < 0 || handIndex >= player.hand.length) return;
    
    // Swap
    const discardedCard = player.hand[handIndex];
    player.hand[handIndex] = player.pendingDrawnCard;
    
    // Handle special cards
    if (discardedCard.rank === Rank.King || discardedCard.rank === Rank.Queen || discardedCard.rank === Rank.Jack) {
      // Start a new stack
      if (!G.specialAbilityStack) G.specialAbilityStack = [];
      G.specialAbilityStack.push({ card: discardedCard, playerID });
      G.stackActive = true;
      // Don't end turn yet - allow for stacking
    } else {
      G.discardPile.push(discardedCard);
      // Open quick action window for matching discards
      openQuickActionWindow(G, discardedCard);
      events.endTurn();
    }
    
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
  },
  discardDrawnCard: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (player.pendingDrawnCardSource !== 'deck') return;
    
    // Handle special cards
    if (player.pendingDrawnCard.rank === Rank.King || 
        player.pendingDrawnCard.rank === Rank.Queen || 
        player.pendingDrawnCard.rank === Rank.Jack) {
      // Start a new stack
      if (!G.specialAbilityStack) G.specialAbilityStack = [];
      G.specialAbilityStack.push({ card: player.pendingDrawnCard, playerID });
      G.stackActive = true;
      // Don't end turn yet - allow for stacking
    } else {
      G.discardPile.push(player.pendingDrawnCard);
      // Open quick action window for matching discards
      openQuickActionWindow(G, player.pendingDrawnCard);
      events.endTurn();
    }
    
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
  },
  resolveSpecialAbility: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }, abilityArgs?: any) => {
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
    player.pendingSpecialAbility = null;
    
    // If there are more abilities in the stack, resolve the next one
    // Otherwise end the turn
    if (G.specialAbilityStack && G.specialAbilityStack.length > 0) {
      allGameMoves.resolveStack({ G, events });
    } else {
      events.endTurn();
    }
  },
  // --- EXISTING MOVES ---
  drawCard: ({ G, playerID }: { G: CheckGameState; playerID?: string }) => {
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

  performPeek: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }) => {
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
    events.endTurn();
  },

  // --- STACKING SPECIAL ABILITY MOVES ---
  stackSpecialCard: ({ G, playerID }: { G: CheckGameState; playerID?: string }, card: Card, handIndex: number) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    
    // Validate card is in hand and is a special card
    if (handIndex < 0 || handIndex >= player.hand.length) return;
    const cardInHand = player.hand[handIndex];
    if (cardInHand !== card) return;
    if (![Rank.King, Rank.Queen, Rank.Jack].includes(card.rank)) return;
    
    // If stack is not active, check if this is a valid initial stack card
    if (!G.stackActive) {
      // Can only start stack on your turn with a special card
      const topDiscard = G.discardPile[G.discardPile.length - 1];
      if (!topDiscard || ![Rank.King, Rank.Queen, Rank.Jack].includes(topDiscard.rank)) return;
    } else {
      // If stack is active, card must match rank of last stacked card
      const lastStackedCard = G.specialAbilityStack?.[G.specialAbilityStack.length - 1]?.card;
      if (!lastStackedCard || lastStackedCard.rank !== card.rank) return;
    }
    
    // Add card to stack
    if (!G.specialAbilityStack) G.specialAbilityStack = [];
    G.specialAbilityStack.push({ card, playerID });
    G.stackActive = true;
    
    // Remove card from player's hand
    player.hand.splice(handIndex, 1);
  },

  resolveStack: ({ G, events }: { G: CheckGameState; events: any }, abilityArgs?: any) => {
    if (!G.specialAbilityStack || !G.stackActive) return;
    
    // Pop the top card from the stack
    const stackEntry = G.specialAbilityStack.pop();
    if (!stackEntry) {
      G.stackActive = false;
      return;
    }
    
    const { card, playerID } = stackEntry;
    const player = G.players[playerID];
    if (!player) return;
    
    // Set up pending ability for the popped card
    player.pendingSpecialAbility = {
      card,
      source: 'stack'
    };
    
    // Clear stack if empty
    if (G.specialAbilityStack.length === 0) {
      G.stackActive = false;
    }
  },

  // --- QUICK ACTION MOVES ---
  attemptQuickAction: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }, handIndex: number) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player) return;
    if (handIndex < 0 || handIndex >= player.hand.length) return;

    // Validate quick action window is open
    if (!isQuickActionWindowOpen(G)) return;
    
    const card = player.hand[handIndex];
    const matchTarget = G.quickActionWindow?.topCard;
    if (!matchTarget) return;

    // Check if the card matches
    if (card.rank === matchTarget.rank) {
      // Success! Remove card from hand and add to discard
      player.hand.splice(handIndex, 1);
      G.discardPile.push(card);
      
      // Close the quick action window
      closeQuickActionWindow(G);
      
      // If player's hand is empty, they automatically call "Check"
      if (player.hand.length === 0) {
        // TODO: Implement "Check" logic
      }
    } else {
      // Failed match - apply penalty
      player.quickActionPenalty = true;
      
      // Draw penalty card immediately
      if (G.deck.length > 0) {
        const penaltyCard = G.deck.pop();
        if (penaltyCard) {
          player.hand.push(penaltyCard);
        }
      }
    }
  },
};

const CheckGame: Game<CheckGameState> = {
  name: 'Check',

  setup: ({ random, ctx }: { random: { Die: (sides: number) => number; Shuffle: <T>(deck: T[]) => T[]; [key: string]: any; }; ctx: Ctx }) => {
    const deck: Card[] = [];
    for (const suit of Object.values(Suit)) {
      for (const rank of Object.values(Rank)) {
        deck.push({ suit: suit as Suit, rank: rank as Rank });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = random.Die(i + 1) - 1;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const players: { [playerID: string]: PlayerState } = {};
    for (const playerID of ctx.playOrder) {
      const hand: Card[] = [];
      for (let k = 0; k < 4; k++) {
        const card = deck.pop();
        if (card) {
          hand.push(card);
        } else {
          console.error("Deck ran out during initial deal!");
        }
      }
      players[playerID] = { hand, hasUsedInitialPeek: false };
    }

    return {
      deck,
      players,
      discardPile: [],
      specialAbilityStack: [],
      stackActive: false,
      quickActionWindow: {
        active: false,
        startTime: 0,
        duration: 5000,
        topCard: undefined
      }
    };
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
      endIf: (context: { G: CheckGameState, ctx: Ctx }) => { 
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
        stackSpecialCard: allGameMoves.stackSpecialCard,
        resolveStack: allGameMoves.resolveStack,
        attemptQuickAction: allGameMoves.attemptQuickAction,
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
