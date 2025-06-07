import { StateCreator } from 'zustand';
import io, { Socket } from 'socket.io-client';
import { GameStoreState } from './gameStore';

export interface SocketState {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
}

export const socketMiddleware = (
  config: StateCreator<GameStoreState & SocketState>
): StateCreator<GameStoreState & SocketState> => (set, get, api) => {
  const connect = () => {
    const socket = io('http://localhost:3001'); // Your server URL

    socket.on('connect', () => {
      console.log('Socket connected!');
      set({ socket });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected!');
      set({ socket: null });
    });

    // Add generic listeners that update the store
    socket.on('gameStateUpdate', (newGameState) => {
        get().setGameState(newGameState);
    });

    socket.on('logMessage', (logMessage) => {
        get().addLogMessage(logMessage);
    });

    socket.on('chatMessage', (chatMessage) => {
        get().addChatMessage(chatMessage);
    });
    
    // You can add more listeners for other events here

    if (get().socket) {
      get().disconnect();
    }
    set({ socket });
  };

  const disconnect = () => {
    get().socket?.disconnect();
    set({ socket: null });
  };

  const emit = (event: string, ...args: any[]) => {
    get().socket?.emit(event, ...args);
  };

  return config(
    (args) => {
      set(args);
    },
    get,
    { ...api, ...{ connect, disconnect, emit } }
  );
}; 