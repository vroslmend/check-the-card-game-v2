import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createActor, ActorRefFrom } from 'xstate';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

import { gameMachine, GameContext } from './game-machine.js';
import { generatePlayerView } from './state-redactor.js';
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
} from 'shared-types';

// These types are defined in the game machine file. We are aliasing them here
// for use within this file. This avoids circular dependencies.
type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;

console.log('Server starting with Socket.IO...');

const activeGameMachines = new Map<GameId, GameMachineActorRef>();
const socketSessionMap = new Map<string, { gameId: GameId; playerId: PlayerId }>();
const pendingCallbacks = new Map<string, (response: CreateGameResponse | JoinGameResponse) => void>();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
console.log(`[Server] CORS origin set to: ${CORS_ORIGIN}`);

const httpServer = http.createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket: Socket) => {
  console.log(`[Server] New connection: ${socket.id}`);

  const registerSocketSession = (gameId: GameId, playerId: PlayerId) => {
    socketSessionMap.set(socket.id, { gameId, playerId });
  };

  const getSocketSession = () => {
    return socketSessionMap.get(socket.id);
  };
  
  const broadcastGameState = (gameId: GameId, gameActor: GameMachineActorRef) => {
    const snapshot = gameActor.getSnapshot();
    const socketsInRoom = io.sockets.adapter.rooms.get(gameId);
    if (!socketsInRoom) return;

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

      const gameActor = createActor(gameMachine, { input: { gameId } });

      // Listener for the initial join callback
      const joinSubscription = gameActor.on('PLAYER_JOIN_SUCCESSFUL', (event) => {
        if (event.playerId === playerId) {
          const playerSpecificView = generatePlayerView(gameActor.getSnapshot(), playerId);
          callback({ success: true, gameId, playerId, gameState: playerSpecificView });
          // This is a one-time subscription for the creating player
          joinSubscription.unsubscribe();
        }
      });

      // Listener for broadcasting game state to all in the room
      const broadcastSubscription = gameActor.on('BROADCAST_GAME_STATE', () => {
          broadcastGameState(gameId, gameActor);
      });

      // Listener for sending a specific event to a single player
      const directMessageSubscription = gameActor.on('SEND_EVENT_TO_PLAYER', (event) => {
          const { playerId: targetPlayerId, eventName, eventData } = event.payload;
          const targetPlayer = gameActor.getSnapshot().context.players[targetPlayerId];
          if (targetPlayer?.socketId && targetPlayer.isConnected) {
              io.to(targetPlayer.socketId).emit(eventName, eventData);
          }
      });

      // General subscriber for cleanup
      const actorSubscription = gameActor.subscribe({
          error: (err) => console.error(`[GameMachineError] Game ${gameId}:`, err),
          complete: () => {
              console.log(`[Server] Game machine for ${gameId} has completed.`);
              activeGameMachines.delete(gameId);
              // Clean up all subscriptions for this actor
              broadcastSubscription.unsubscribe();
              directMessageSubscription.unsubscribe();
              actorSubscription.unsubscribe(); // unsubscribe self
          }
      });
      
      gameActor.start();
      activeGameMachines.set(gameId, gameActor);
      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      
      gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData, playerId });

    } catch (e: any) {
      console.error(`[Server-CreateGame] Error: ${e.message}`, e);
      if (callback) callback({ success: false, message: `Server error: ${e.message || 'Unknown error'}` });
    }
  });

  socket.on(SocketEventName.JOIN_GAME, (data: { gameId: string, playerSetupData: InitialPlayerSetupData }, callback: (response: JoinGameResponse) => void) => {
      const { gameId, playerSetupData } = data;
      const gameActor = activeGameMachines.get(gameId);

      if (!gameActor) {
          if (callback) callback({ success: false, message: 'Game not found.' });
          return;
      }

      const currentState = gameActor.getSnapshot();
      if (currentState.value !== GameStage.WAITING_FOR_PLAYERS) {
        if (callback) callback({ success: false, message: 'Game has already started.' });
        return;
      }
      
      const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '4', 10);
      if (Object.keys(currentState.context.players).length >= MAX_PLAYERS) {
        if (callback) callback({ success: false, message: 'Game is full.' });
        return;
      }
      
      const playerId = nanoid();
      const finalPlayerSetupData = { ...playerSetupData, id: playerId, socketId: socket.id };

      const joinSubscription = gameActor.on('PLAYER_JOIN_SUCCESSFUL', (event) => {
        if (event.playerId === playerId) {
          const playerSpecificView = generatePlayerView(gameActor.getSnapshot(), playerId);
          callback({ success: true, gameId, playerId, gameState: playerSpecificView });
          joinSubscription.unsubscribe();
        }
      });

      socket.join(gameId);
      registerSocketSession(gameId, playerId);

      gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData, playerId });
  });

  socket.on(SocketEventName.ATTEMPT_REJOIN, (data: { gameId: GameId, playerId: PlayerId }) => {
    const { gameId, playerId } = data;
    const gameActor = activeGameMachines.get(gameId);

    if (gameActor) {
      console.log(`[Server] Player ${playerId} attempting to rejoin game ${gameId} with new socket ${socket.id}`);
      
      const reconnectSubscription = gameActor.on('PLAYER_RECONNECT_SUCCESSFUL', (event) => {
        if(event.playerId === playerId) {
          const playerSpecificView = generatePlayerView(gameActor.getSnapshot(), playerId);
          socket.emit(SocketEventName.GAME_STATE_UPDATE, playerSpecificView);
          reconnectSubscription.unsubscribe();
        }
      });

      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      
      gameActor.send({ type: 'PLAYER_RECONNECTED', playerId, newSocketId: socket.id });

    } else {
      console.warn(`[Server] Attempted rejoin for non-existent game: ${gameId}`);
      // TODO: Maybe emit an error event back to the client?
    }
  });

  socket.on(SocketEventName.PLAYER_ACTION, (action: { type: PlayerActionType, playerId: PlayerId, payload?: any }) => {
    const session = getSocketSession();
    if (!session) return;
    const gameActor = activeGameMachines.get(session.gameId);
    if (gameActor) {
        // We trust the client to send a valid action shape. The machine will validate it.
        // Using `as any` here to bridge the client-side action with the machine's specific event types.
        gameActor.send({ ...action, playerId: session.playerId } as any);
    }
  });

  socket.on(SocketEventName.SEND_CHAT_MESSAGE, (payload: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const session = getSocketSession();
    if (!session) return;
    const gameActor = activeGameMachines.get(session.gameId);
    if (gameActor) {
        gameActor.send({
            type: PlayerActionType.SEND_CHAT_MESSAGE,
            payload,
        });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Connection disconnected: ${socket.id}`);
    const session = getSocketSession();
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
  console.log(`[Server] Listening on port ${PORT}`);
});