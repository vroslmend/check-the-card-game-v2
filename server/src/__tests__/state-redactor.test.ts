import { describe, it, expect } from 'vitest';
import { generatePlayerView } from '../state-redactor.js';
import { CardRank, Suit, TurnPhase, GameStage, PlayerStatus } from 'shared-types';
import type { GameContext } from '../game-machine.js';

describe('State Redactor', () => {
  describe('generatePlayerView', () => {
    it('should redact hidden cards from other players', () => {
      // Create a test game state
      const gameState = {
        context: {
          players: {
            p1: {
              id: 'p1',
              name: 'Player 1',
              hand: [
                { id: 'card1', rank: CardRank.Ace, suit: Suit.Hearts, isFaceDownToOwner: false },
                { id: 'card2', rank: CardRank.Two, suit: Suit.Spades, isFaceDownToOwner: true },
                { id: 'card3', rank: CardRank.King, suit: Suit.Diamonds, isFaceDownToOwner: false },
                { id: 'card4', rank: CardRank.Queen, suit: Suit.Clubs, isFaceDownToOwner: true }
              ],
              score: 0,
              isReady: true,
              isConnected: true,
              status: PlayerStatus.PLAYING,
              isDealer: false,
              hasCalledCheck: false,
              isLocked: false,
              socketId: 'socket1',
              pendingDrawnCard: null,
              forfeited: false
            },
            p2: {
              id: 'p2',
              name: 'Player 2',
              hand: [
                { id: 'card5', rank: CardRank.Five, suit: Suit.Hearts },
                { id: 'card6', rank: CardRank.Six, suit: Suit.Spades }
              ],
              score: 0,
              isReady: true,
              isConnected: true,
              status: PlayerStatus.PLAYING,
              isDealer: false,
              hasCalledCheck: false,
              isLocked: false,
              socketId: 'socket2',
              pendingDrawnCard: null,
              forfeited: false
            }
          },
          deck: [
            { id: 'card7', rank: CardRank.Seven, suit: Suit.Diamonds }
          ],
          discardPile: [
            { id: 'card8', rank: CardRank.Eight, suit: Suit.Hearts }
          ],
          discardPileIsSealed: false,
          errorState: null,
          currentTurnSegment: TurnPhase.DRAW,
          currentPlayerId: 'p1',
          turnOrder: ['p1', 'p2'],
          gameId: 'test-game',
          gameMasterId: null,
          activeAbility: null,
          matchingOpportunity: null,
          checkDetails: null,
          gameover: null,
          lastRoundLoserId: null,
          log: [],
          chat: [],
          abilityStack: [],
        },
        value: GameStage.PLAYING
      };

      // Generate player view for p1
      const p1View = generatePlayerView(gameState as { context: GameContext, value: unknown }, 'p1');

      // Check that p1 can see their own cards
      expect(p1View.players['p1'].hand).toHaveLength(4);
      expect(p1View.players['p1'].hand[0]).toHaveProperty('rank', CardRank.Ace);
      expect(p1View.players['p1'].hand[1]).toHaveProperty('rank', CardRank.Two);
      expect(p1View.players['p1'].hand[2]).toHaveProperty('rank', CardRank.King);
      expect(p1View.players['p1'].hand[3]).toHaveProperty('rank', CardRank.Queen);

      // Check that p1 can't see p2's cards (they should be hidden)
      expect(p1View.players['p2'].hand).toHaveLength(2);
      expect(p1View.players['p2'].hand.every(card => 'facedown' in card && card.facedown === true)).toBe(true);
      
      // Check that the deck is represented as a count, not the actual cards
      expect(p1View).not.toHaveProperty('deck');
      expect(p1View.deckSize).toBe(1);

      // Check that the discard pile is visible
      expect(p1View.discardPile).toHaveLength(1);
      expect(p1View.discardPile[0].rank).toBe(CardRank.Eight);
    });

    it('should include the viewing player ID', () => {
      // Create a minimal test game state
      const gameState = {
        context: {
          players: { 
            p1: {
              id: 'p1',
              name: 'Player 1',
              hand: [],
              score: 0,
              isReady: true,
              isConnected: true,
              status: PlayerStatus.WAITING,
              isDealer: false,
              hasCalledCheck: false,
              isLocked: false,
              socketId: 'socket1',
              pendingDrawnCard: null,
              forfeited: false
            }
          },
          deck: [],
          discardPile: [],
          discardPileIsSealed: false,
          errorState: null,
          gameId: 'test-game',
          gameMasterId: null,
          currentPlayerId: null,
          turnOrder: [],
          currentTurnSegment: null,
          activeAbility: null,
          matchingOpportunity: null,
          checkDetails: null,
          gameover: null,
          lastRoundLoserId: null,
          log: [],
          chat: [],
          abilityStack: [],
        },
        value: GameStage.WAITING_FOR_PLAYERS
      };

      // Generate player view for p1
      const p1View = generatePlayerView(gameState as { context: GameContext, value: unknown }, 'p1');

      // Check that viewingPlayerId is set correctly
      expect(p1View.viewingPlayerId).toBe('p1');
    });

    it('should preserve game stage and current player', () => {
      // Create a test game state with specific phase and current player
      const gameState = {
        context: {
          players: { 
            p1: {
              id: 'p1',
              name: 'Player 1',
              hand: [],
              score: 0,
              isReady: true,
              isConnected: true,
              status: PlayerStatus.PLAYING,
              isDealer: false,
              hasCalledCheck: false,
              isLocked: false,
              socketId: 'socket1',
              pendingDrawnCard: null,
              forfeited: false
            },
            p2: {
              id: 'p2',
              name: 'Player 2',
              hand: [],
              score: 0,
              isReady: true,
              isConnected: true,
              status: PlayerStatus.PLAYING,
              isDealer: false,
              hasCalledCheck: false,
              isLocked: false,
              socketId: 'socket2',
              pendingDrawnCard: null,
              forfeited: false
            }
          },
          deck: [],
          discardPile: [],
          discardPileIsSealed: false,
          errorState: null,
          currentTurnSegment: TurnPhase.DRAW,
          currentPlayerId: 'p2',
          turnOrder: ['p1', 'p2'],
          gameId: 'test-game',
          gameMasterId: null,
          activeAbility: null,
          matchingOpportunity: null,
          checkDetails: null,
          gameover: null,
          lastRoundLoserId: null,
          log: [],
          chat: [],
          abilityStack: [],
        },
        value: GameStage.PLAYING
      };

      // Generate player view for p1
      const p1View = generatePlayerView(gameState as { context: GameContext, value: unknown }, 'p1');

      // Check that phase and current player are preserved
      expect(p1View.gameStage).toBe(GameStage.PLAYING);
      expect(p1View.turnPhase).toBe(TurnPhase.DRAW);
      expect(p1View.currentPlayerId).toBe('p2');
    });
  });
}); 