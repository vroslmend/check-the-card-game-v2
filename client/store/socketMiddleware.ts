import { StateCreator } from 'zustand';
import io, { Socket } from 'socket.io-client';
import { GameStoreState } from './gameStore';
import { SocketEventName, ClientCheckGameState, RichGameLogMessage, ChatMessage } from 'shared-types';

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
    const serverUrl = process.env.NEXT_WEBSOCKET_URL;
    const socket = io(serverUrl); // Your server URL

    socket.on('connect', () => {
      console.log('Socket connected!');
      set({ socket });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected!');
      set({ socket: null });
    });

    // Add generic listeners that update the store
    socket.on(SocketEventName.GAME_STATE_UPDATE, (newGameState: ClientCheckGameState) => {
        get().setGameState(newGameState);
    });

    socket.on(SocketEventName.SERVER_LOG_ENTRY, (logMessage: RichGameLogMessage) => {
        get().addLogMessage(logMessage);
    });

    socket.on(SocketEventName.CHAT_MESSAGE, (chatMessage: ChatMessage) => {
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