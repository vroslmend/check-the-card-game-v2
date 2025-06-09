import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createActor, type Actor } from 'xstate';
import { gameMachine } from './game-machine.js';
import { 
  InitialPlayerSetupData, 
  PlayerActionType, 
  GamePhase,
  Rank,
  Suit
} from 'shared-types';

// By creating a specific type for our actor, we give TypeScript
// the hint it needs to understand the machine's full capabilities.
type GameMachineActor = Actor<typeof gameMachine>;

// Test timeout to prevent hanging tests
const TEST_TIMEOUT = 1000;

describe('gameMachine', () => {
  // Store actors created during tests for cleanup
  let actors: GameMachineActor[] = [];

  // Clean up any actors after each test
  afterEach(() => {
    actors.forEach(actor => {
      if (actor.getSnapshot().status !== 'stopped') {
        actor.stop();
      }
    });
    actors = [];
    vi.restoreAllMocks();
  });

  it('should be created without errors', () => {
    expect(() => createActor(gameMachine, { input: { gameId: 'smoke-test' } })).not.toThrow();
  });

  it('should have the correct initial context when started', () => {
    const actor: GameMachineActor = createActor(gameMachine, {
      input: {
        gameId: 'test-game-123',
      },
    }).start();
    actors.push(actor);
    
    const initialState = actor.getSnapshot();

    expect(initialState.value).toBe('awaitingPlayers');
    expect(Object.keys(initialState.context.players).length).toBe(0);
    expect(initialState.context.deck.length).toBe(52);
    expect(initialState.context.discardPile.length).toBe(0);
    expect(initialState.context.currentPlayerId).toBe('');
    expect(initialState.context.logHistory).toBeDefined();
    expect(initialState.context.logHistory?.length).toBe(0);
    expect(initialState.context.gameId).toBe('test-game-123');
  });

  it('should allow a player to join an empty game and emit a log', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Test timed out waiting for event'));
      }, TEST_TIMEOUT);

      const actor: GameMachineActor = createActor(gameMachine, {
        input: { gameId: 'test-game-join' },
      });
      actors.push(actor);

      actor.on('EMIT_LOG_PUBLIC', (event) => {
        try {
          clearTimeout(timeoutId);
          const snapshot = actor.getSnapshot();
          const player = snapshot.context.players['player-1'];

          // Assert context changes are correct at the time of emit
          expect(Object.keys(snapshot.context.players).length).toBe(1);
          expect(player).toBeDefined();
          expect(player.name).toBe('Vroslmend');
          expect(snapshot.context.turnOrder).toEqual(['player-1']);
          expect(snapshot.context.gameMasterId).toBe('player-1');

          // Assert emitted event payload
          expect(event.type).toBe('EMIT_LOG_PUBLIC');
          expect(event.publicLogData.message).toContain('joined the game');

          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      actor.start();

      const playerSetupData: InitialPlayerSetupData = {
        id: 'player-1',
        name: 'Vroslmend',
      };

      actor.send({
        type: 'PLAYER_JOIN_REQUEST',
        playerSetupData,
      });
    });
  });

  it('should transition to initialPeekPhase when all players are ready', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Test timed out waiting for phase transition'));
      }, TEST_TIMEOUT);

      const actor: GameMachineActor = createActor(gameMachine, {
        input: { gameId: 'test-game-start' },
      });
      actors.push(actor);

      const subscription = actor.subscribe((snapshot) => {
        if (snapshot.value === 'initialPeekPhase') {
          try {
            clearTimeout(timeoutId);
            // ASSERT: Game state is now in the peek phase
            expect(snapshot.context.currentPhase).toBe('initialPeekPhase');
            expect(snapshot.context.players['player-1'].cardsToPeek).toHaveLength(2);
            expect(snapshot.context.players['player-2'].cardsToPeek).toHaveLength(2);
            
            subscription.unsubscribe();
            resolve();
          } catch (error) {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            reject(error);
          }
        }
      });

      actor.start();

      const player1Setup: InitialPlayerSetupData = { id: 'player-1', name: 'Vroslmend' };
      const player2Setup: InitialPlayerSetupData = { id: 'player-2', name: 'Glarth' };

      // Players join
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: player1Setup });
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: player2Setup });

      // Players declare ready - using proper event type
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-1' });
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-2' });
    });
  });
  
  it('should transition to playPhase after peek timer expires', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Test timed out waiting for phase transition'));
      }, TEST_TIMEOUT);
      
      // Mock the timer to immediately expire
      vi.useFakeTimers();
      
      const actor: GameMachineActor = createActor(gameMachine, {
        input: { gameId: 'test-game-start' },
      });
      actors.push(actor);
      
      const subscription = actor.subscribe((snapshot) => {
        if (snapshot.context.currentPhase === 'playPhase') {
          try {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            resolve();
          } catch (error) {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            reject(error);
          }
        }
      });
      
      actor.start();
      
      const player1Setup: InitialPlayerSetupData = { id: 'player-1', name: 'Vroslmend' };
      const player2Setup: InitialPlayerSetupData = { id: 'player-2', name: 'Glarth' };
      
      // Players join and become ready
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: player1Setup });
      actor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: player2Setup });
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-1' });
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-2' });
      
      // Fast-forward through peek phase
      vi.advanceTimersByTime(10000); // Advance by the PEEK_TOTAL_DURATION_MS value
      vi.useRealTimers();
    });
  });
  
  it('should allow a player to draw from the deck during their turn', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Test timed out waiting for turn action'));
      }, TEST_TIMEOUT);
      
      // Set up a game with players already in play phase
      const actor: GameMachineActor = createActor(gameMachine, {
        input: { gameId: 'test-game-draw' },
      });
      actors.push(actor);
      actor.start();
      
      // Add players
      actor.send({ 
        type: 'PLAYER_JOIN_REQUEST', 
        playerSetupData: { id: 'player-1', name: 'Vroslmend' } 
      });
      actor.send({ 
        type: 'PLAYER_JOIN_REQUEST', 
        playerSetupData: { id: 'player-2', name: 'Glarth' } 
      });
      
      // Make players ready
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-1' });
      actor.send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId: 'player-2' });
      
      // Monitor for draw action result
      actor.on('EMIT_LOG_PUBLIC', (event) => {
        const snapshot = actor.getSnapshot();
        
        // If we see a draw action in the log and the player has a pending drawn card
        if (event.publicLogData.message?.includes('drew a card from the deck') &&
            snapshot.context.players['player-1']?.pendingDrawnCard) {
          try {
            clearTimeout(timeoutId);
            
            // Verify the player has a pending card
            const player = snapshot.context.players['player-1'];
            expect(player.pendingDrawnCard).toBeTruthy();
            expect(player.pendingDrawnCardSource).toBe('deck');
            
            resolve();
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        }
      });
      
      // Force the machine into play phase with player-1 as current player
      actor.send({ type: 'PEEK_TIMER_EXPIRED' });
      
      // Wait a bit for the play phase transition
      setTimeout(() => {
        // Check if we're in play phase
        const snapshot = actor.getSnapshot();
        if (snapshot.context.currentPhase === 'playPhase') {
          // Send a draw action
          actor.send({ 
            type: PlayerActionType.DRAW_FROM_DECK, 
            playerId: 'player-1' 
          });
        } else {
          clearTimeout(timeoutId);
          reject(new Error('Game did not transition to play phase'));
        }
      }, 100);
    });
  });
  
  it('should handle player disconnection and reconnection', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Test timed out waiting for reconnection'));
      }, TEST_TIMEOUT);
      
      const actor: GameMachineActor = createActor(gameMachine, {
        input: { gameId: 'test-game-connectivity' },
      });
      actors.push(actor);
      actor.start();
      
      // Add a player
      actor.send({ 
        type: 'PLAYER_JOIN_REQUEST', 
        playerSetupData: { id: 'player-1', name: 'Vroslmend', socketId: 'socket-1' } 
      });
      
      // Disconnect the player
      actor.send({
        type: 'PLAYER_DISCONNECTED',
        playerId: 'player-1'
      });
      
      // Verify disconnect state
      let snapshot = actor.getSnapshot();
      expect(snapshot.context.players['player-1'].isConnected).toBe(false);
      
      // Reconnect with new socket
      actor.send({
        type: 'PLAYER_RECONNECTED',
        playerId: 'player-1',
        newSocketId: 'socket-2'
      });
      
      // Verify reconnect state
      snapshot = actor.getSnapshot();
      try {
        expect(snapshot.context.players['player-1'].isConnected).toBe(true);
        expect(snapshot.context.players['player-1'].socketId).toBe('socket-2');
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  });
});