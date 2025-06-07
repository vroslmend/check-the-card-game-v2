import { create } from 'zustand';
// Import actual types from shared-types
import type {
  Card,
  PlayerId,
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
} from 'shared-types'; // Updated path alias
import { socketMiddleware, SocketState } from './socketMiddleware';

// Placeholder types removed

export interface GameStoreState extends SocketState {
  currentGameState: ClientCheckGameState | null;
  localPlayerId: string | null;
  gameLog: RichGameLogMessage[];
  chatMessages: ChatMessage[];
  setGameState: (gameState: ClientCheckGameState) => void;
  setLocalPlayerId: (id: string | null) => void;
  addLogMessage: (logMessage: RichGameLogMessage) => void;
  addChatMessage: (chatMessage: ChatMessage) => void;
  // Add more actions as needed, e.g., for updating parts of the state
  resetGameStore: () => void;
}

const initialState: Pick<GameStoreState, 'currentGameState' | 'localPlayerId' | 'gameLog' | 'chatMessages'> = {
  currentGameState: null,
  localPlayerId: null,
  gameLog: [],
  chatMessages: [],
};

export const useGameStore = create<GameStoreState>()(
  socketMiddleware((set, get) => ({
    ...initialState,
    socket: null,
    connect: () => {}, // Handled by middleware
    disconnect: () => {}, // Handled by middleware
    emit: (event: string, ...args: any[]) => {}, // Handled by middleware
    setGameState: (newGameState) => {
      set((state) => ({ 
        currentGameState: newGameState,
        gameLog: newGameState.logHistory ? newGameState.logHistory : state.gameLog, 
        chatMessages: state.chatMessages 
      }));
    },
    setLocalPlayerId: (id) => set({ localPlayerId: id }),
    addLogMessage: (logMessage) =>
      set((state) => {
        if (logMessage.logId && state.gameLog.some(log => log.logId === logMessage.logId)) {
          return { gameLog: state.gameLog };
        }
        const newLog = [...state.gameLog, logMessage].sort((a, b) => (a.timestamp && b.timestamp ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() : 0));
        return { gameLog: newLog };
      }),
    addChatMessage: (chatMessage) =>
      set((state) => {
        if (state.chatMessages.some(msg => msg.id === chatMessage.id)) {
          return { chatMessages: state.chatMessages };
        }
        const newChat = [...state.chatMessages, chatMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return { chatMessages: newChat };
      }),
    resetGameStore: () => set(initialState),
    // Implement other actions here
  }))
);

// Example of how to use the store in a component:
// import { useGameStore } from './gameStore';
// const gameState = useGameStore((state) => state.gameState);
// const setGameState = useGameStore((state) => state.setGameState); 