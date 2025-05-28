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
}

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
    if (discardedCard.rank === Rank.King || discardedCard.rank === Rank.Queen || discardedCard.rank === Rank.Jack) {
      player.pendingSpecialAbility = { card: discardedCard, source: 'discard' };
      // Do not end turn yet; ability must be resolved
    } else {
      G.discardPile.push(discardedCard);
      events.endTurn();
    }
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
  },
  discardDrawnCard: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }) => {
    if (!playerID) return;
    const player = G.players[playerID];
    if (!player || !player.pendingDrawnCard) return;
    if (player.pendingDrawnCardSource !== 'deck') return; // Only allowed if drawn from deck
    if (player.pendingDrawnCard.rank === Rank.King || player.pendingDrawnCard.rank === Rank.Queen || player.pendingDrawnCard.rank === Rank.Jack) {
      player.pendingSpecialAbility = { card: player.pendingDrawnCard, source: 'draw' };
      // Do not end turn yet; ability must be resolved
    } else {
      G.discardPile.push(player.pendingDrawnCard);
      events.endTurn();
    }
    player.pendingDrawnCard = null;
    player.pendingDrawnCardSource = null;
  },
  resolveSpecialAbility: ({ G, playerID, events }: { G: CheckGameState; playerID?: string; events: any }, abilityArgs: any) => {
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
    // Discard the special card and clear ability
    G.discardPile.push(card);
    player.pendingSpecialAbility = null;
    events.endTurn();
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
      }
    },
  },
  // --- END PHASES ---

};

const server = Server({ games: [CheckGame] });
const PORT = parseInt(process.env.PORT || '8000', 10);
server.run(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
