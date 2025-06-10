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
} from 'shared-types';

// These types are defined in the game machine file. We are aliasing them here
// for use within this file. This avoids circular dependencies.
type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;

console.log('Server starting with Socket.IO...');

const activeGameMachines = new Map<GameId, GameMachineActorRef>();
const socketSessionMap = new Map<string, { gameId: GameId; playerId: PlayerId }>();

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
  
  const broadcastGameState = (gameId: GameId, fullGameState: GameContext) => {
    const socketsInRoom = io.sockets.adapter.rooms.get(gameId);
    if (!socketsInRoom) return;

    socketsInRoom.forEach(socketId => {
      const session = socketSessionMap.get(socketId);
      if (session?.playerId) {
        const playerSpecificView = generatePlayerView(fullGameState, session.playerId);
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

      let createGameCallbackCalled = false;

      gameActor.subscribe({
        next: (snapshot) => {
          if (!snapshot) return;

          for (const emitted of (snapshot as any).emitted || []) {
            switch (emitted.type) {
              case 'BROADCAST_GAME_STATE':
                broadcastGameState(gameId, snapshot.context);
                break;
              
              case 'SEND_EVENT_TO_PLAYER':
                const targetSocketId = Object.values(snapshot.context.players).find(p => p.id === emitted.payload.playerId)?.socketId;
                if(targetSocketId) {
                    io.to(targetSocketId).emit(emitted.payload.eventName, emitted.payload.eventData);
                }
                break;
            }
          }

          if (callback && !createGameCallbackCalled && snapshot.context.players[playerId]) {
            const clientState = generatePlayerView(snapshot.context, playerId);
            callback({ success: true, gameId, playerId, gameState: clientState });
            createGameCallbackCalled = true;
            console.log(`[Server] Player ${playerSetupData.name} created game ${gameId}. Initial state sent.`);
          }
        },
        error: (err) => console.error(`[GameMachineError] Game ${gameId}:`, err),
        complete: () => {
          console.log(`[Server] Game machine for ${gameId} has completed.`);
          activeGameMachines.delete(gameId);
        }
      });
      
      gameActor.start();
      activeGameMachines.set(gameId, gameActor);
      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData });
      
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
      
      const MAX_PLAYERS = 4; // This should ideally be shared from the machine config
      if (Object.keys(currentState.context.players).length >= MAX_PLAYERS) {
        if (callback) callback({ success: false, message: 'Game is full.' });
        return;
      }
      
      const playerId = nanoid();
      const finalPlayerSetupData = { ...playerSetupData, id: playerId, socketId: socket.id };

      let callbackHasBeenCalled = false;
      const tempSubscription = gameActor.subscribe((snapshot) => {
        // The machine's context has been updated with the new player.
        // We can now safely send the updated state to the joining player.
        if (snapshot.context.players[playerId] && !callbackHasBeenCalled) {
          const playerSpecificView = generatePlayerView(snapshot.context, playerId);
          if (callback) {
            callback({ success: true, gameId, playerId, gameState: playerSpecificView });
          }
          callbackHasBeenCalled = true;
          // The subscription has served its purpose, so we remove it.
          tempSubscription.unsubscribe();
        }
      });

      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      gameActor.send({ type: 'PLAYER_JOIN_REQUEST', playerSetupData: finalPlayerSetupData });
  });

  socket.on(SocketEventName.ATTEMPT_REJOIN, (data: { gameId: GameId, playerId: PlayerId }) => {
    const { gameId, playerId } = data;
    const gameActor = activeGameMachines.get(gameId);

    if (gameActor) {
      console.log(`[Server] Player ${playerId} attempting to rejoin game ${gameId} with new socket ${socket.id}`);
      socket.join(gameId);
      registerSocketSession(gameId, playerId);
      gameActor.send({ type: 'PLAYER_RECONNECTED', playerId, newSocketId: socket.id });

      // After a short delay, send the latest state to the rejoining player
      setTimeout(() => {
        const latestState = gameActor.getSnapshot().context;
        const playerSpecificView = generatePlayerView(latestState, playerId);
        socket.emit(SocketEventName.GAME_STATE_UPDATE, playerSpecificView);
        console.log(`[Server] Sent latest game state to rejoining player ${playerId}`);
      }, 250);

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
        gameActor.send({ ...action, playerId: session.playerId });
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