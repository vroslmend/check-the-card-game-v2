"use client";
import { io, Socket } from 'socket.io-client';
import { 
  SocketEventName,
  type PlayerActionType,
  type InitialPlayerSetupData,
  type CreateGameResponse,
  type JoinGameResponse,
  type ClientCheckGameState,
  type RichGameLogMessage,
  type Card,
  type PlayerId,
  type AttemptRejoinResponse,
  type ServerToClientEvents,
  type ClientToServerEvents
} from 'shared-types';
import logger from './logger';

// Base interface for any action sent to the server.
// The server will use the 'type' property to discriminate the union.
export interface PlayerAction {
  type: PlayerActionType;
  [key: string]: any;
}

// The URL should be an environment variable, but we'll default it for convenience.
const URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';

// This is a more robust way to create a socket singleton in a Next.js/hot-reloading environment.
// We store the socket instance on the global object in development to prevent it from being
// re-created every time the module is hot-reloaded.
declare global {
  var socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
}

const attemptImmediateRejoin = (socket: Socket<ServerToClientEvents, ClientToServerEvents>) => {
  try {
    const persistedSessionJSON = sessionStorage.getItem('playerSession');
    if (persistedSessionJSON) {
      const session = JSON.parse(persistedSessionJSON);
      if (session.gameId && session.playerId) {
        logger.info({ gameId: session.gameId, playerId: session.playerId }, "Attempting immediate rejoin on socket connection");
        
        // Emit rejoin attempt as soon as we have a connection
        socket.emit(SocketEventName.ATTEMPT_REJOIN, 
          { gameId: session.gameId, playerId: session.playerId }, 
          (response: AttemptRejoinResponse) => {
            if (response.success) {
              logger.info("Immediate rejoin successful");
              // Store the game state for later hydration
              if (response.gameState) {
                sessionStorage.setItem('initialGameState', JSON.stringify(response.gameState));
              }
              // We'll let the state machine handle the rest when it initializes
            } else {
              logger.warn({ error: response.message }, "Immediate rejoin failed");
            }
          }
        );
      }
    }
  } catch (e) {
    logger.error({ error: e }, "Error attempting immediate rejoin");
  }
};

const createSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  logger.info({ url: URL }, "Creating new socket connection.");
  const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
  });

  newSocket.on('connect', () => {
    logger.info({ socketId: newSocket.id }, "Socket connected");
    // Attempt to rejoin immediately if we have session data
    attemptImmediateRejoin(newSocket);
  });

  newSocket.on('disconnect', (reason) => {
    logger.warn({ reason }, "Socket disconnected");
  });

  newSocket.on('connect_error', (err) => {
    logger.error({ error: err.message }, "Socket connection error");
  });

  return newSocket;
};

// In production, we always create a new socket.
// In development, we use the global object to ensure a single instance.
const socket = process.env.NODE_ENV === 'production' 
  ? createSocket() 
  : (global.socket || (global.socket = createSocket()));

export { socket }; 