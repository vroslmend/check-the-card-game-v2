import { StateCreator } from 'zustand';
import io from 'socket.io-client';
import { GameStore } from './types'; // Import from types.ts
import { SocketEventName } from 'shared-types';

export const socketMiddleware = <T extends GameStore>(
    config: StateCreator<T, [], []>
): StateCreator<T, [], []> => (set, get, api) => {

    const connect = () => {
        if (get().socket) return; 

        const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:8000';
        const socket = io(serverUrl);

        socket.on('connect', () => {
            console.log('Socket connected!');
            set({ socket } as Partial<T>);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected!');
            set({ socket: null } as Partial<T>);
        });

        socket.on(SocketEventName.GAME_STATE_UPDATE, (payload) => {
            get().handleGameStateUpdate(payload);
        });

        socket.on(SocketEventName.SERVER_LOG_ENTRY, (logMessage) => {
            get().addLogMessage(logMessage);
        });

        socket.on(SocketEventName.CHAT_MESSAGE, (chatMessage) => {
            get().addChatMessage(chatMessage);
        });
    };

    const disconnect = () => {
        get().socket?.disconnect();
        set({ socket: null } as Partial<T>);
    };

    const emit = (event: string, ...args: any[]) => {
        get().socket?.emit(event, ...args);
    };

    const initialState = config(
        (updater) => set(updater as any), 
        get, 
        api
    );
    
    return {
        ...initialState,
        connect,
        disconnect,
        emit,
    };
};