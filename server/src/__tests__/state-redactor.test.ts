import { describe, it, expect } from 'vitest';
import { generatePlayerView } from '../state-redactor.js';
import { GameContext, ServerPlayer } from '../game-machine.js';
import { GameStage, CardRank, Suit, PlayerStatus, Card } from 'shared-types';

// Mocks and Test Data
const P1_ID = 'player1';
const P2_ID = 'player2';

const MOCK_CARD_1: Card = { id: 'c1', rank: CardRank.Ace, suit: Suit.Clubs };
const MOCK_CARD_2: Card = { id: 'c2', rank: CardRank.King, suit: Suit.Diamonds };
const MOCK_CARD_3: Card = { id: 'c3', rank: CardRank.Ten, suit: Suit.Hearts };
const MOCK_CARD_4: Card = { id: 'c4', rank: CardRank.Seven, suit: Suit.Spades };

const createMockPlayer = (id: string, name: string, overrides: Partial<ServerPlayer> = {}): ServerPlayer => ({
  id,
  name,
  socketId: `socket_${id}`,
  hand: [],
  isReady: true,
  isDealer: false,
  hasCalledCheck: false,
  isLocked: false,
  score: 0,
  isConnected: true,
  pendingDrawnCard: null,
  forfeited: false,
  status: PlayerStatus.PLAYING,
  ...overrides,
});

const createMockContext = (overrides: Partial<GameContext> = {}): GameContext => ({
  gameId: 'test-game',
  deck: [MOCK_CARD_3, MOCK_CARD_4],
  players: {
    [P1_ID]: createMockPlayer(P1_ID, 'Alice', { hand: [MOCK_CARD_1] }),
    [P2_ID]: createMockPlayer(P2_ID, 'Bob', { hand: [MOCK_CARD_2] }),
  },
  discardPile: [],
  turnOrder: [P1_ID, P2_ID],
  gameMasterId: P1_ID,
  currentPlayerId: P1_ID,
  currentTurnSegment: null,
  gameStage: GameStage.PLAYING,
  matchingOpportunity: null,
  abilityStack: [],
  checkDetails: null,
  winnerId: null,
  gameover: null,
  lastRoundLoserId: null,
  log: [],
  chat: [],
  discardPileIsSealed: false,
  errorState: null,
  // FIX: Add the new required properties with default values
  maxPlayers: 4,
  cardsPerPlayer: 4,
  ...overrides,
});

describe('state-redactor: generatePlayerView', () => {

  it('should show the viewing player their own hand', () => {
    const context = createMockContext();
    const snapshot = { context, value: GameStage.PLAYING };

    const player1View = generatePlayerView(snapshot, P1_ID);

    expect(player1View.players[P1_ID].hand).toEqual([MOCK_CARD_1]);
  });

  it('should redact the opponent\'s hand', () => {
    const context = createMockContext();
    const snapshot = { context, value: GameStage.PLAYING };

    const player1View = generatePlayerView(snapshot, P1_ID);

    expect(player1View.players[P2_ID].hand).toEqual([{ facedown: true }]);
  });

  it('should show the viewing player their pending drawn card', () => {
    const context = createMockContext({
      players: {
        [P1_ID]: createMockPlayer(P1_ID, 'Alice', { pendingDrawnCard: { card: MOCK_CARD_3, source: 'deck' } }),
        [P2_ID]: createMockPlayer(P2_ID, 'Bob'),
      },
    });
    const snapshot = { context, value: GameStage.PLAYING };

    const player1View = generatePlayerView(snapshot, P1_ID);

    expect(player1View.players[P1_ID].pendingDrawnCard).toEqual(MOCK_CARD_3);
  });

  it('should redact an opponent\'s pending drawn card', () => {
    const context = createMockContext({
      players: {
        [P1_ID]: createMockPlayer(P1_ID, 'Alice', { pendingDrawnCard: { card: MOCK_CARD_3, source: 'deck' } }),
        [P2_ID]: createMockPlayer(P2_ID, 'Bob'),
      },
    });
    const snapshot = { context, value: GameStage.PLAYING };

    const player2View = generatePlayerView(snapshot, P2_ID);

    expect(player2View.players[P1_ID].pendingDrawnCard).toEqual({ facedown: true });
  });

  it('should correctly expose public game state properties', () => {
    const context = createMockContext({
      deck: [MOCK_CARD_1, MOCK_CARD_2, MOCK_CARD_3],
      discardPile: [MOCK_CARD_4],
      currentPlayerId: P2_ID
    });
    const snapshot = { context, value: GameStage.PLAYING };

    const view = generatePlayerView(snapshot, P1_ID);

    expect(view.deckSize).toBe(3);
    expect(view.discardPile).toEqual([MOCK_CARD_4]);
    expect(view.currentPlayerId).toBe(P2_ID);
    expect(view.viewingPlayerId).toBe(P1_ID);
    expect(view.gameId).toBe('test-game');
  });

  it('should correctly derive gameStage from a simple state value', () => {
    const context = createMockContext();
    const snapshot = { context, value: GameStage.GAMEOVER };

    const view = generatePlayerView(snapshot, P1_ID);
    expect(view.gameStage).toBe(GameStage.GAMEOVER);
  });

  it('should correctly derive gameStage from a nested state value', () => {
    const context = createMockContext();
    const snapshot = { context, value: { [GameStage.PLAYING]: 'matching' } };
    
    const view = generatePlayerView(snapshot, P1_ID);
    expect(view.gameStage).toBe(GameStage.PLAYING);
  });
});