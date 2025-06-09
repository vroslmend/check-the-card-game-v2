import { io, Socket } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';

// Create a single, shared socket instance.
// Components and services can import this directly.
export const socket: Socket = io(URL, {
  autoConnect: false, // We will connect manually when needed.
}); 