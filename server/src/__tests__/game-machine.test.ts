import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createActor, Actor } from 'xstate';
import { gameMachine } from '../game-machine.js';
import { PlayerActionType, GameStage, CardRank, Suit, Card } from 'shared-types';

// Mock the logger to prevent console output during tests
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Test Constants
const P1 = { id: 'player1', name: 'Alice', sid: 's1' };
const P2 = { id: 'player2', name: 'Bob', sid: 's2' };
const P3 = { id: 'player3', name: 'Charlie', sid: 's3' };
const GAME_ID = 'test-game';

// Card Constants for predictable tests
const S2: Card = { id: 'S2', suit: Suit.Spades, rank: CardRank.Two };
const H2: Card = { id: 'H2', suit: Suit.Hearts, rank: CardRank.Two };
const C2: Card = { id: 'C2', suit: Suit.Clubs, rank: CardRank.Two };
const D5: Card = { id: 'D5', suit: Suit.Diamonds, rank: CardRank.Five };
const H9: Card = { id: 'H9', suit: Suit.Hearts, rank: CardRank.Nine };
const DJ: Card = { id: 'DJ', suit: Suit.Diamonds, rank: CardRank.Jack };
const SK: Card = { id: 'SK', suit: Suit.Spades, rank: CardRank.King };
const CK: Card = { id: 'CK', suit: Suit.Clubs, rank: CardRank.King };
const DA: Card = { id: 'DA', suit: Suit.Diamonds, rank: CardRank.Ace };

// Test Utilities
const createTestActor = (input: Partial<Parameters<typeof createActor<typeof gameMachine>>[1]['input']> = {}) => {
  return createActor(gameMachine, {
    input: {
      gameId: GAME_ID,
      ...input
    }
  });
};

const setupTwoPlayerGame = (actor: Actor<typeof gameMachine>) => {
  actor.start();
  actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P1.id, playerSetupData: { name: P1.name, socketId: P1.sid }});
  actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P2.id, playerSetupData: { name: P2.name, socketId: P2.sid }});
  actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P1.id });
  actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P2.id });
  actor.send({ type: PlayerActionType.START_GAME, playerId: P1.id });
  actor.send({ type: 'TIMER.PEEK_EXPIRED' });
};

describe('gameMachine', () => {

  describe('Lobby and Game Setup', () => {
    it('should allow a player to join and become game master', () => {
      const actor = createTestActor();
      actor.start();
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P1.id, playerSetupData: { name: P1.name }});
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players[P1.id]).toBeDefined();
      expect(snapshot.context.gameMasterId).toBe(P1.id);
      expect(snapshot.value).toBe(GameStage.WAITING_FOR_PLAYERS);
    });

    it('should not start the game with only one player', () => {
      const actor = createTestActor();
      actor.start();
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P1.id, playerSetupData: { name: P1.name }});
      actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P1.id });
      actor.send({ type: PlayerActionType.START_GAME, playerId: P1.id });
      expect(actor.getSnapshot().value).toBe(GameStage.WAITING_FOR_PLAYERS);
    });

    it('should start the game when two players are ready and game master starts it', () => {
        const actor = createTestActor();
        setupTwoPlayerGame(actor);
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'turn' });
        expect(snapshot.context.currentPlayerId).toBe(P1.id);
        expect(snapshot.context.players[P1.id].hand.length).toBe(4);
        expect(snapshot.context.players[P2.id].hand.length).toBe(4);
    });
  });

  describe('Configurable Game Settings', () => {
    it('should respect the maxPlayers setting', () => {
      const actor = createTestActor({ maxPlayers: 2 });
      setupTwoPlayerGame(actor); // Game is now full
      
      // Attempt to join a third player
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P3.id, playerSetupData: { name: P3.name } });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players[P3.id]).toBeUndefined();
      expect(Object.keys(snapshot.context.players).length).toBe(2);
    });

    it('should respect the cardsPerPlayer setting', () => {
      const actor = createTestActor({ cardsPerPlayer: 2 });
      setupTwoPlayerGame(actor);
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players[P1.id].hand.length).toBe(2);
      expect(snapshot.context.players[P2.id].hand.length).toBe(2);
    });
  });

  describe('Resilient Disconnection Handling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should allow the game to continue if a player fails to reconnect in a 3+ player game', () => {
      const actor = createTestActor();
      actor.start();
      // Setup a 3 player game
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P1.id, playerSetupData: { name: P1.name, socketId: P1.sid }});
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P2.id, playerSetupData: { name: P2.name, socketId: P2.sid }});
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerId: P3.id, playerSetupData: { name: P3.name, socketId: P3.sid }});
      actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P1.id });
      actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P2.id });
      actor.send({ type: PlayerActionType.DECLARE_LOBBY_READY, playerId: P3.id });
      actor.send({ type: PlayerActionType.START_GAME, playerId: P1.id });
      actor.send({ type: 'TIMER.PEEK_EXPIRED' });

      expect(actor.getSnapshot().context.currentPlayerId).toBe(P1.id);

      // P1 disconnects during their turn
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: P1.id });
      expect(actor.getSnapshot().value).toEqual({ [GameStage.PLAYING]: 'error' });
      
      // Simulate reconnect timer running out
      vi.advanceTimersByTime(30000);

      // Assert game continues
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'turn' });
      expect(snapshot.context.players[P1.id].forfeited).toBe(true);
      expect(snapshot.context.turnOrder).not.toContain(P1.id);
      expect(snapshot.context.currentPlayerId).toBe(P2.id); // Turn should advance
    });

    it('should end the game if a player fails to reconnect in a 2-player game', () => {
      const actor = createTestActor();
      setupTwoPlayerGame(actor);

      // P1 disconnects
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: P1.id });
      expect(actor.getSnapshot().value).toEqual({ [GameStage.PLAYING]: 'error' });

      // Simulate reconnect timer running out
      vi.advanceTimersByTime(30000);

      // Assert game ends
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(GameStage.GAMEOVER);
      expect(snapshot.context.gameover?.winnerIds).toContain(P2.id);
      expect(snapshot.context.gameover?.loserId).toBe(P1.id);
    });
  });
  
  describe('Basic Turn Flow', () => {
    let actor: Actor<typeof gameMachine>;
    beforeEach(() => {
        actor = createTestActor();
        setupTwoPlayerGame(actor);
    });

    it('should allow the current player to draw from the deck', () => {
        const deckSizeBefore = actor.getSnapshot().context.deck.length;
        actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.deck.length).toBe(deckSizeBefore - 1);
        expect(snapshot.context.players[P1.id].pendingDrawnCard).toBeDefined();
        expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'discard' });
    });

    it('should allow a player to swap their drawn card with one in hand', () => {
        actor.getSnapshot().context.players[P1.id].hand = [S2, H2, C2, D5];
        const cardToSwap = actor.getSnapshot().context.players[P1.id].hand[0];
        actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
        const drawnCard = actor.getSnapshot().context.players[P1.id].pendingDrawnCard!.card;
        
        actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P1.id, payload: { handCardIndex: 0 } });

        const snapshot = actor.getSnapshot();
        expect(snapshot.context.players[P1.id].hand[0]).toEqual(drawnCard);
        expect(snapshot.context.discardPile.at(-1)).toEqual(cardToSwap);
        expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'matching' });
    });

    it('should allow a player to discard their drawn card directly', () => {
        actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
        const drawnCard = actor.getSnapshot().context.players[P1.id].pendingDrawnCard!.card;

        actor.send({ type: PlayerActionType.DISCARD_DRAWN_CARD, playerId: P1.id });
        
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.discardPile.at(-1)).toEqual(drawnCard);
        expect(snapshot.context.players[P1.id].pendingDrawnCard).toBeNull();
        expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'matching' });
    });
  });

  describe('Matching Logic', () => {
    let actor: Actor<typeof gameMachine>;
    beforeEach(() => {
      actor = createTestActor();
      setupTwoPlayerGame(actor);
      actor.getSnapshot().context.players[P1.id].hand = [S2, H9];
      actor.getSnapshot().context.players[P2.id].hand = [H2, DJ];
      actor.getSnapshot().context.discardPile = [D5];
      actor.getSnapshot().context.currentPlayerId = P1.id;
    });

    it('should allow another player to match a discard', () => {
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
      actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P1.id, payload: { handCardIndex: 0 } }); // P1 discards S2
      
      expect(actor.getSnapshot().value).toEqual({ [GameStage.PLAYING]: 'matching' });
      expect(actor.getSnapshot().context.matchingOpportunity?.cardToMatch).toEqual(S2);

      actor.send({ type: PlayerActionType.ATTEMPT_MATCH, playerId: P2.id, payload: { handCardIndex: 0 } }); // P2 matches with H2

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players[P2.id].hand.length).toBe(1);
      expect(snapshot.context.discardPile.at(-1)).toEqual(H2);
      expect(snapshot.context.discardPileIsSealed).toBe(true);
      expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'endOfTurn' });
    });

    it('should allow a player to match their own discard', () => {
      actor.getSnapshot().context.players[P1.id].hand = [S2, H2, C2];
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
      actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P1.id, payload: { handCardIndex: 0 } }); // P1 discards S2

      actor.send({ type: PlayerActionType.ATTEMPT_MATCH, playerId: P1.id, payload: { handCardIndex: 0 } }); // P1 matches with H2

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players[P1.id].hand.length).toBe(2);
      expect(snapshot.context.discardPile.at(-1)).toEqual(H2);
    });
  });

  describe('Special Abilities & LIFO Stacking', () => {
    let actor: Actor<typeof gameMachine>;
    beforeEach(() => {
      actor = createTestActor();
      setupTwoPlayerGame(actor);
    });

    it('should trigger a King ability upon discard', () => {
      actor.getSnapshot().context.players[P1.id].hand = [SK, H9];
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
      actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P1.id, payload: { handCardIndex: 0 } });
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'ability' });
      expect(snapshot.context.abilityStack.length).toBe(1);
      expect(snapshot.context.abilityStack[0]?.type).toBe('king');
      expect(snapshot.context.abilityStack[0]?.playerId).toBe(P1.id);
    });

    it('should correctly implement LIFO for a special card match', () => {
      actor.getSnapshot().context.players[P1.id].hand = [SK, H9];
      actor.getSnapshot().context.players[P2.id].hand = [CK, DJ];
      actor.getSnapshot().context.currentPlayerId = P1.id;

      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P1.id });
      actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P1.id, payload: { handCardIndex: 0 } });
      actor.send({ type: PlayerActionType.ATTEMPT_MATCH, playerId: P2.id, payload: { handCardIndex: 0 } });

      let snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual({ [GameStage.PLAYING]: 'ability' });
      expect(snapshot.context.abilityStack.length).toBe(2);
      expect(snapshot.context.abilityStack.at(-1)?.playerId).toBe(P2.id);
      expect(snapshot.context.abilityStack.at(0)?.playerId).toBe(P1.id);

      actor.send({ type: PlayerActionType.USE_ABILITY, playerId: P2.id, payload: { action: 'skip' } });
      snapshot = actor.getSnapshot();
      
      expect(snapshot.context.abilityStack.length).toBe(1);
      expect(snapshot.context.abilityStack.at(-1)?.playerId).toBe(P1.id);
    });
  });

  describe('Calling Check and Final Turns', () => {
    let actor: Actor<typeof gameMachine>;
    beforeEach(() => {
        actor = createTestActor();
        setupTwoPlayerGame(actor);
    });

    it('should enter final turns when a player calls "Check"', () => {
      actor.send({ type: PlayerActionType.CALL_CHECK, playerId: P1.id });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(GameStage.FINAL_TURNS);
      expect(snapshot.context.players[P1.id].isLocked).toBe(true);
      expect(snapshot.context.checkDetails?.callerId).toBe(P1.id);
      expect(snapshot.context.checkDetails?.finalTurnOrder).toEqual([P2.id]);
      expect(snapshot.context.currentPlayerId).toBe(P2.id);
    });

    it('should enter final turns automatically when a player matches to an empty hand', () => {
      actor.getSnapshot().context.players[P1.id].hand = [S2];
      actor.getSnapshot().context.players[P2.id].hand = [H2, DJ];
      actor.getSnapshot().context.currentPlayerId = P2.id;
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P2.id });
      actor.send({ type: PlayerActionType.SWAP_AND_DISCARD, playerId: P2.id, payload: { handCardIndex: 0 } }); // P2 discards H2
      
      actor.send({ type: PlayerActionType.ATTEMPT_MATCH, playerId: P1.id, payload: { handCardIndex: 0 } }); // P1 matches with S2
      
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(GameStage.FINAL_TURNS);
      expect(snapshot.context.players[P1.id].isLocked).toBe(true);
      expect(snapshot.context.checkDetails?.callerId).toBe(P1.id);
    });

    it('should transition to scoring after all final turns are complete', () => {
      actor.send({ type: PlayerActionType.CALL_CHECK, playerId: P1.id });
      
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P2.id });
      actor.send({ type: PlayerActionType.DISCARD_DRAWN_CARD, playerId: P2.id });
      actor.send({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId: P1.id });
      actor.send({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId: P2.id });
      
      expect(actor.getSnapshot().value).toBe(GameStage.SCORING);
    });
  });

  describe('Scoring', () => {
    it('should correctly calculate scores, including negative for Aces', () => {
      const actor = createTestActor();
      setupTwoPlayerGame(actor);
      actor.getSnapshot().context.players[P1.id].hand = [DA, S2];
      actor.getSnapshot().context.players[P2.id].hand = [D5, H9];
      
      // Manually trigger scoring
      actor.send({ type: PlayerActionType.CALL_CHECK, playerId: P1.id });
      actor.send({ type: PlayerActionType.DRAW_FROM_DECK, playerId: P2.id });
      actor.send({ type: PlayerActionType.DISCARD_DRAWN_CARD, playerId: P2.id });
      actor.send({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId: P1.id });
      actor.send({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT, playerId: P2.id });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe(GameStage.SCORING);
      expect(snapshot.context.gameover?.playerScores[P1.id]).toBe(1);
      expect(snapshot.context.gameover?.playerScores[P2.id]).toBe(14);
      expect(snapshot.context.gameover?.winnerIds).toContain(P1.id);
    });
  });
});