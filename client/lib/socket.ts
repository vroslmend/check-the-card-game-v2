"use client";
import { io, Socket } from 'socket.io-client';
import { 
  type ServerToClientEvents,
  type ClientToServerEvents
} from 'shared-types';
import logger from './logger';

const URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';

logger.info({ socketUrl: URL }, 'Initializing Socket.IO client');

// We create the socket instance once and export it.
// The connection itself will be managed by our state machine.
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false, // <-- IMPORTANT: We will connect manually.
  reconnection: true,
  reconnectionAttempts: 5,
});

// Optional: You can add global listeners here for debugging, but the primary
// event handling should be in the Providers component.
socket.on('connect', () => {
  logger.info({ socketId: socket.id }, "Socket connected");
});

socket.on('disconnect', (reason) => {
  logger.warn({ reason }, "Socket disconnected");
});

socket.on('connect_error', (err) => {
  logger.error({ error: err.message }, "Socket connection error");
});

export { socket };