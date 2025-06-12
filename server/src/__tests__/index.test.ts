import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketEventName,
  CreateGameResponse,
  JoinGameResponse,
  PlayerActionType,
  ClientCheckGameState
} from 'shared-types';

// Mock the game machine to prevent its actual logic from running
// We are testing the network layer (index.ts), not the game logic here
vi.mock('../game-machine.js', () => ({
  gameMachine: {
    // Provide a mock implementation that can be spied on if needed
    transition: vi.fn(),
    getInitialState: vi.fn(),
  },
}));

// Mock the state redactor, as we don't need its real implementation
vi.mock('../state-redactor.js', () => ({
  generatePlayerView: vi.fn((snapshot, viewingPlayerId) => ({
    // Return a valid, minimal ClientCheckGameState
    gameId: snapshot.context.gameId,
    viewingPlayerId,
    players: {},
    deckSize: 52,
    discardPile: [],
    turnOrder: [],
    gameStage: 'WAITING_FOR_PLAYERS',
    // ... fill other required fields with default values
    gameMasterId: null,
    currentPlayerId: null,
    turnPhase: null,
    abilityStack: [],
    matchingOpportunity: null,
    checkDetails: null,
    gameover: null,
    lastRoundLoserId: null,
    log: [],
    chat: [],
    discardPileIsSealed: false,
  })),
}));


describe('Socket Server (index.ts)', () => {
  let server: HttpServer;
  let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let port: number;
  
  // Setup a server and a client before each test
  beforeEach(async () => {
    // Dynamically import to get a fresh instance with mocks
    const { httpServer } = await import('../index.js');
    server = httpServer;

    await new Promise<void>((resolve) => {
      server.listen(() => {
        const addr = server.address();
        port = typeof addr === 'string' ? parseInt(addr, 10) : addr!.port;
        clientSocket = ioc(`http://localhost:${port}`, {
          // Required for tests to connect reliably
          transports: ['websocket'],
        });
        clientSocket.on('connect', resolve);
      });
    });
  });

  // Teardown after each test
  afterEach(() => {
    clientSocket.disconnect();
    server.close();
  });

  it('should allow a user to create a game and receive a success response', async () => {
    const response = await new Promise<CreateGameResponse>((resolve) => {
        clientSocket.emit(SocketEventName.CREATE_GAME, { name: 'Test Player' }, (res) => {
            resolve(res);
        });
    });

    expect(response.success).toBe(true);
    expect(response.gameId).toBeDefined();
    expect(response.playerId).toBeDefined();
    expect(response.gameState).toBeDefined();
  });

  it('should allow a second player to join an existing game', async () => {
    const createResponse = await new Promise<CreateGameResponse>((resolve) => {
      clientSocket.emit(SocketEventName.CREATE_GAME, { name: 'Alice' }, resolve);
    });
    const { gameId } = createResponse;

    const clientSocket2 = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) => clientSocket2.on('connect', resolve));
    
    const joinResponse = await new Promise<JoinGameResponse>((resolve) => {
      clientSocket2.emit(SocketEventName.JOIN_GAME, gameId!, { name: 'Bob' }, resolve);
    });

    expect(joinResponse.success).toBe(true);
    expect(joinResponse.gameId).toBe(gameId);
    expect(joinResponse.playerId).toBeDefined();
    
    clientSocket2.close();
  });

  it('should reject a player trying to join a non-existent game', async () => {
    const joinResponse = await new Promise<JoinGameResponse>((resolve) => {
      clientSocket.emit(SocketEventName.JOIN_GAME, 'non-existent-game', { name: 'Bob' }, resolve);
    });

    expect(joinResponse.success).toBe(false);
    expect(joinResponse.message).toContain('Game not found');
  });

  it('should handle player actions and result in a game state broadcast', async () => {
    // Player 1 creates the game and establishes a session
    await new Promise<CreateGameResponse>((resolve) => {
        clientSocket.emit(SocketEventName.CREATE_GAME, { name: 'Alice' }, resolve);
    });

    // Listen for the game state update that should result from the action
    const updatePromise = new Promise<void>((resolve) => {
        clientSocket.on(SocketEventName.GAME_STATE_UPDATE, (newState) => {
            // We just need to know we received a broadcast.
            expect(newState).toBeDefined();
            resolve();
        });
    });

    // Send the action with the correct shape. No 'playerId' is needed here.
    clientSocket.emit(SocketEventName.PLAYER_ACTION, {
        type: PlayerActionType.DECLARE_LOBBY_READY
        // No payload is needed for this specific action, but if it were,
        // it would be inside a `payload` property: payload: { ... }
    });

    // Wait for the server to process the action and broadcast the update.
    await expect(updatePromise).resolves.toBeUndefined();
  });
});