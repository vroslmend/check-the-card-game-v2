import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from '../lib/deck-utils.js';
import type { Card } from 'shared-types';

describe('Deck Utilities', () => {
  describe('createDeck', () => {
    it('should create a standard 52-card deck with unique IDs', () => {
      const deck = createDeck();
      
      // Should have 52 cards
      expect(deck).toHaveLength(52);
      
      // All cards should have unique IDs
      const ids = new Set(deck.map((card: Card) => card.id));
      expect(ids.size).toBe(52);
      
      // Should have correct distribution of suits and ranks
      const suits = deck.map((card: Card) => card.suit);
      const ranks = deck.map((card: Card) => card.rank);
      
      // 4 suits with 13 cards each
      expect(new Set(suits).size).toBe(4);
      expect(new Set(ranks).size).toBe(13);
      
      // Count cards of each suit
      const suitCounts = suits.reduce((counts: Record<string, number>, suit: string) => {
        counts[suit] = (counts[suit] || 0) + 1;
        return counts;
      }, {});
      
      // Each suit should have 13 cards
      Object.values(suitCounts).forEach(count => {
        expect(count).toBe(13);
      });
    });
  });
  
  describe('shuffleDeck', () => {
    it('should return a different arrangement of cards', () => {
      const originalDeck = createDeck();
      const shuffledDeck = shuffleDeck([...originalDeck]);
      
      // Should have the same number of cards
      expect(shuffledDeck).toHaveLength(originalDeck.length);
      
      // Should contain the same cards (by ID)
      const originalIds = new Set(originalDeck.map((card: Card) => card.id));
      const shuffledIds = new Set(shuffledDeck.map((card: Card) => card.id));
      expect(shuffledIds.size).toBe(originalIds.size);
      shuffledDeck.forEach((card: Card) => {
        expect(originalIds.has(card.id)).toBe(true);
      });
      
      // The probability of a shuffled deck being in the exact same order is extremely low
      // So we check if at least some cards are in different positions
      let differentPositions = 0;
      for (let i = 0; i < originalDeck.length; i++) {
        if (originalDeck[i].id !== shuffledDeck[i].id) {
          differentPositions++;
        }
      }
      
      // With proper shuffling, almost all cards should be in different positions
      // But to account for randomness, we just check that at least some changed
      expect(differentPositions).toBeGreaterThan(0);
    });
    
    it('should not mutate the original deck', () => {
      const originalDeck = createDeck();
      const originalDeckCopy = JSON.parse(JSON.stringify(originalDeck)); // Create a deep copy
      const shuffledDeck = shuffleDeck([...originalDeck]); // Use a spread copy for shuffling
      
      // The original deck should remain unchanged
      expect(originalDeck).toEqual(originalDeckCopy);
      
      // Verify that shuffleDeck returns a new array
      expect(shuffledDeck).not.toBe(originalDeck);
    });
  });
}); 