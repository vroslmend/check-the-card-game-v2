import { create } from 'zustand';
// Import actual types from shared-types
import type {
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
} from '@shared'; // Updated path alias

// Define placeholder types if not importing
interface PlaceholderClientCheckGameState {
  gameId: string | null;
  players: any[]; // Define more specific player type later
  currentPlayerId: string | null;
  // ... other game state fields
  [key: string]: any; // Allow for expansion
}
interface PlaceholderRichGameLogMessage {
  id: string;
  timestamp: number;
  message: string;
  // ... other log fields
}
interface PlaceholderChatMessage {
  id: string;
  timestamp: number;
  sender: string;
  message: string;
  // ... other chat fields
}

export interface GameStoreState {
  gameState: ClientCheckGameState | null;
  gameLog: RichGameLogMessage[];
  chatMessages: ChatMessage[];
  setGameState: (gameState: ClientCheckGameState) => void;
  addLogMessage: (logMessage: RichGameLogMessage) => void;
  addChatMessage: (chatMessage: ChatMessage) => void;
  // Add more actions as needed, e.g., for updating parts of the state
  resetGameStore: () => void;
}

const initialState: Pick<GameStoreState, 'gameState' | 'gameLog' | 'chatMessages'> = {
  gameState: null,
  gameLog: [],
  chatMessages: [],
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,
  setGameState: (gameState) => {
    // Optionally, merge with existing logs/chat if gameState updates don't replace them
    // For now, direct replacement as per CheckGameState including logHistory
    set({ gameState, gameLog: gameState.logHistory || get().gameLog, chatMessages: get().chatMessages });
  },
  addLogMessage: (logMessage) =>
    set((state) => {
      const newLog = [...state.gameLog, logMessage].sort((a, b) => (a.timestamp && b.timestamp ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() : 0));
      // Keep only the last N messages if needed
      // const MAX_LOG_MESSAGES = 100;
      // if (newLog.length > MAX_LOG_MESSAGES) newLog.splice(0, newLog.length - MAX_LOG_MESSAGES);
      return { gameLog: newLog };
    }),
  addChatMessage: (chatMessage) =>
    set((state) => {
      const newChat = [...state.chatMessages, chatMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      // const MAX_CHAT_MESSAGES = 100;
      // if (newChat.length > MAX_CHAT_MESSAGES) newChat.splice(0, newChat.length - MAX_CHAT_MESSAGES);
      return { chatMessages: newChat };
    }),
  resetGameStore: () => set(initialState),
  // Implement other actions here
}));

// Example of how to use the store in a component:
// import { useGameStore } from './gameStore';
// const gameState = useGameStore((state) => state.gameState);
// const setGameState = useGameStore((state) => state.setGameState); 