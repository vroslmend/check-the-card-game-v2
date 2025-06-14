import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createActor, ActorRefFrom } from 'xstate';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

import { gameMachine, GameContext } from './game-machine.js';
import { generatePlayerView } from './state-redactor.js';
import logger from './lib/logger.js';
import {
  InitialPlayerSetupData,
  PlayerActionType,
  CreateGameResponse,
  JoinGameResponse,
  SocketEventName,
  PlayerId,
  GameId,
  GameStage,
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  ServerToClientEventName,
  AttemptRejoinResponse,
} from 'shared-types';

// These types are defined in the game machine file. We are aliasing them here
// for use within this file. This avoids circular dependencies.
type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;

logger.info('Server starting with Socket.IO...');

const activeGameMachines = new Map<GameId, GameMachineActorRef>();
const socketSessionMap = new Map<string, { gameId: GameId; playerId: PlayerId }>();
const pendingCallbacks = new Map<string, (response: CreateGameResponse | JoinGameResponse) => void>();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
logger.info({ corsOrigin: CORS_ORIGIN }, `CORS origin set`);

export const httpServer = http.createServer((req, res) => {
  // Health check endpoint for Render
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  // Fallback for other requests
  res.writeHead(404);
  res.end();
});
export const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGIN.split(','),
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket: Socket) => {
  logger.info({ socketId: socket.id }, 'New connection');

  const registerSocketSession = (gameId: GameId, playerId: PlayerId) => {
    socketSessionMap.set(socket.id, { gameId, playerId });
  };

  const getSocketSession = () => {
    return socketSessionMap.get(socket.id);
  };
  
  const broadcastGameState = (gameId: GameId, gameActor: GameMachineActorRef) => {
    const snapshot = gameActor.getSnapshot();
    const socketsInRoom = io.sockets.adapter.rooms.get(gameId);
    if (!socketsInRoom) {
      logger.warn({ gameId }, 'Broadcast state failed: room does not exist or is empty.');
      return;
    }

    logger.debug({ gameId, players: Array.from(socketsInRoom) }, 'Broadcasting game state');

    socketsInRoom.forEach(socketId => {
      const session = socketSessionMap.get(socketId);
      if (session?.playerId) {
        const playerSpecificView = generatePlayerView(snapshot, session.playerId);
        io.to(socketId).emit(SocketEventName.GAME_STATE_UPDATE, playerSpecificView);
      }
    });
  };

  socket.on(SocketEventName.CREATE_GAME, (playerSetupData: InitialPlayerSetupData, callback: (response: CreateGameResponse) => void) => {
    try {
      const gameId = nanoid(6);
      const playerId = nanoid();
      const finalPlayerSetupData = { ...playerSetupData, id: playerId, socketId: socket.id };

      logger.info({ gameId, playerId, playerName: playerSetupData.name }, 'Creating game');

      const gameActor = createActor(gameMachine, { 
        input: { gameId }
        // If you need to pass custom settings:
        // input: { gameId, maxPlayers: playerSetupData.maxPlayers } 
      });

      // General listener for broadcasting game state to all in the room
      const broadcastSubscription = gameActor.on('BROADCAST_GAME_STATE', () => {
          broadcastGameState(gameId, gameActor);
      });
      
      // General listener for broadcasting chat messages
      const chatSubscription = gameActor.on('BROADCAST_CHAT_MESSAGE', (event) => {
        io.to(gameId).emit(SocketEventName.NEW_CHAT_MESSAGE, event.chatMessage);
      });

      // General listener for sending a specific event to a single player
      const directMessageSubscription = gameActor.on('SEND_EVENT_TO_PLAYER', (event) => {
          const { playerId: targetPlayerId, eventName, eventData } = event.payload;
          const targetPlayer = gameActor.getSnapshot().context.players[targetPlayerId];
          if (targetPlayer?.socketId && targetPlayer.isConnected) {
              io.to(targetPlayer.socketId).emit(eventName as any, eventData as any);
          }
      });

      const actorSubscription = gameActor.subscribe({
          error: (err) => logger.error({ err, gameId }, 'Game machine error'),
          complete: () => {
              logger.info({ gameId }, 'Game machine has completed.');
              activeGameMachines.delete(gameId);
              broadcastSubscription.unsubscribe();
              chatSubscription.unsubscribe();
              directMessageSubscription.unsubscribe();
              actorSubscription.unsubscribe();
          }
      });
      
      gameActor.start();
      activeGameMachines.set(gameId, gameActor);
      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      
      // One-time listener: wait for the machine to confirm the player was added
      const joinSubscription = gameActor.on('PLAYER_JOIN_SUCCESSFUL', (event) => {
        if (event.playerId === playerId) {
          logger.info({ gameId, playerId }, 'PLAYER_JOIN_SUCCESSFUL event received for creator. Responding to client.');
          const creatorView = generatePlayerView(gameActor.getSnapshot(), playerId);
          if (callback) {
            callback({ success: true, gameId, playerId, gameState: creatorView });
          }
          joinSubscription.unsubscribe();
        }
      });

      // Send the join request to the machine. The response will be handled by the listener above.
      gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData, playerId });

    } catch (e: any) {
      logger.error({ err: e }, `[Server-CreateGame] Error`);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });

  socket.on(SocketEventName.JOIN_GAME, (gameId: string, playerSetupData: InitialPlayerSetupData, callback: (response: JoinGameResponse) => void) => {
      try {
        const gameActor = activeGameMachines.get(gameId);

        if (!playerSetupData) {
          logger.error({ gameId, socketId: socket.id }, 'Join failed: playerSetupData is missing.');
          if (callback) callback({ success: false, message: 'Player data is missing.' });
          return;
        }

        logger.info({ gameId, playerName: playerSetupData.name, socketId: socket.id }, 'Player attempting to join game');

        if (!gameActor) {
            logger.warn({ gameId }, 'Join failed: game not found.');
            if (callback) callback({ success: false, message: 'Game not found.' });
            return;
        }

        const currentState = gameActor.getSnapshot();
        if (currentState.context.gameStage !== GameStage.WAITING_FOR_PLAYERS) {
          logger.warn({ gameId, currentState: currentState.value }, 'Join failed: game has already started.');
          if (callback) callback({ success: false, message: 'Game has already started.' });
          return;
        }
        
        if (Object.keys(currentState.context.players).length >= currentState.context.maxPlayers) {
          logger.warn({ gameId, playerCount: Object.keys(currentState.context.players).length }, 'Join failed: game is full.');
          if (callback) callback({ success: false, message: 'Game is full.' });
          return;
        }
        
        const playerId = nanoid();
        const finalPlayerSetupData = { ...playerSetupData, id: playerId, socketId: socket.id };

        socket.join(gameId);
        registerSocketSession(gameId, playerId);

        // Set up a listener for the machine to confirm the join before responding to the client
        const joinSubscription = gameActor.on('PLAYER_JOIN_SUCCESSFUL', (event) => {
          if (event.playerId === playerId) {
            logger.info({ gameId, playerId }, 'PLAYER_JOIN_SUCCESSFUL event received from machine. Responding to client.');
            const playerSpecificView = generatePlayerView(gameActor.getSnapshot(), playerId);
            if (callback) {
              callback({ success: true, gameId, playerId, gameState: playerSpecificView });
            }
            joinSubscription.unsubscribe();
          }
        });

        // Send the join request to the machine
        gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData, playerId });

        // The broadcast will be triggered by the machine itself once state updates, so no manual broadcast here.

      } catch (e: any) {
        logger.error({ err: e }, `[Server-JoinGame] Error`);
        if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
      }
  });

  socket.on(SocketEventName.ATTEMPT_REJOIN, (data: { gameId: GameId, playerId: PlayerId }, callback: (r: AttemptRejoinResponse) => void) => {
    try {
      const { gameId, playerId } = data;
      const gameActor = activeGameMachines.get(gameId);

      if (!gameActor) {
        logger.warn({ gameId, playerId }, 'Attempted rejoin for non-existent game');
        if (callback) callback({ success: false, message: 'Game not found.' });
        return;
      }
      
      logger.info({ playerId, gameId, newSocketId: socket.id }, 'Player attempting to rejoin game');
      
      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      
      // Send the reconnect event to the machine to update the player's socketId
      gameActor.send({ type: 'PLAYER_RECONNECTED', playerId, newSocketId: socket.id });

      // FIX: Immediately invoke the callback with the latest game state.
      const snapshot = gameActor.getSnapshot();
      const playerSpecificView = generatePlayerView(snapshot, playerId);
      if (callback) {
        callback({ success: true, gameState: playerSpecificView, logs: snapshot.context.log });
      }
      
      // After confirming with the rejoining player, broadcast to update everyone else's view
      // (e.g., to show the reconnected player's status as 'connected').
      broadcastGameState(gameId, gameActor);

    } catch (e: any) {
      logger.error({ err: e }, `[Server-Rejoin] Error`);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });

  socket.on(SocketEventName.PLAYER_ACTION, (action: { type: PlayerActionType, playerId: PlayerId, payload?: any }) => {
    const session = getSocketSession();
    if (!session) {
      logger.warn({ action, socketId: socket.id }, 'Player action received from socket without a session.');
      return;
    }
    const gameActor = activeGameMachines.get(session.gameId);
    if (gameActor) {
        logger.debug({ action, gameId: session.gameId, playerId: session.playerId }, 'Player action received');
        // We trust the client to send a valid action shape. The machine will validate it.
        // Using `as any` here to bridge the client-side action with the machine's specific event types.
        gameActor.send({ ...action, playerId: session.playerId } as any);
    }
  });

  socket.on(SocketEventName.SEND_CHAT_MESSAGE, (payload: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const session = getSocketSession();
    if (!session) {
      logger.warn({ payload, socketId: socket.id }, 'Chat message received from socket without a session.');
      return;
    }
    const gameActor = activeGameMachines.get(session.gameId);
    if (gameActor) {
        logger.debug({ payload, gameId: session.gameId, playerId: session.playerId }, 'Chat message received');
        gameActor.send({
            type: PlayerActionType.SEND_CHAT_MESSAGE,
            payload,
        });
    }
  });

  socket.on('disconnect', () => {
    const session = getSocketSession();
    logger.info({ socketId: socket.id, session }, 'Connection disconnected');
    if (session) {
      const gameActor = activeGameMachines.get(session.gameId);
      if (gameActor) {
        gameActor.send({ type: 'PLAYER_DISCONNECTED', playerId: session.playerId });
      }
      socketSessionMap.delete(socket.id);
    }
  });

});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server listening');
});