import { create } from 'zustand';
import { GameStore } from './types'; // Import from types.ts
import { socketMiddleware } from './socketMiddleware';
import { InitialPlayerSetupData, SocketEventName } from 'shared-types';
import { v4 as uuidv4 } from 'uuid';

const initialState: Pick<GameStore, 'gameId' | 'currentGameState' | 'localPlayerId' | 'gameLog' | 'chatMessages' | 'isSidePanelOpen'> = {
  gameId: null,
  currentGameState: null,
  localPlayerId: null,
  gameLog: [],
  chatMessages: [],
  isSidePanelOpen: true,
};

const storeCreator = (set: any, get: any): GameStore => ({
  ...initialState,
  socket: null,
  connect: () => console.log('Placeholder connect'),
  disconnect: () => console.log('Placeholder disconnect'),
  emit: () => console.log('Placeholder emit'),
  handleGameStateUpdate: (payload) => {
    set({
      gameId: payload.gameId,
      currentGameState: payload.gameState,
      gameLog: payload.gameState.logHistory ?? get().gameLog,
    });
  },
  setLocalPlayerId: (id) => set({ localPlayerId: id }),
  addLogMessage: (logMessage) =>
    set((state: GameStore) => {
      if (state.gameLog.some(log => log.logId === logMessage.logId)) return {};
      if (!logMessage.timestamp) return {}; // Guard against undefined timestamp
      return { gameLog: [...state.gameLog, logMessage].sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()) };
    }),
  addChatMessage: (chatMessage) =>
    set((state: GameStore) => {
      if (state.chatMessages.some(msg => msg.id === chatMessage.id)) return {};
      if (!chatMessage.timestamp) return {}; // Guard against undefined timestamp
      return { chatMessages: [...state.chatMessages, chatMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) };
    }),
  toggleSidePanel: () => set((state: GameStore) => ({ isSidePanelOpen: !state.isSidePanelOpen })),
  resetGameStore: () => set(initialState),
  createGame: (username) => {
    return new Promise((resolve) => {
      const playerId = uuidv4();
      const playerSetupData: InitialPlayerSetupData = { id: playerId, name: username };
      get().setLocalPlayerId(playerId);

      get().emit(
        SocketEventName.CREATE_GAME,
        playerSetupData,
        (response: { success: boolean; gameId?: string; error?: string }) => {
          if (response.success && response.gameId) {
            resolve(response.gameId);
          } else {
            console.error('Failed to create game:', response.error);
            // Optionally, show a toast or handle the error globally
            resolve(null);
          }
        }
      );
    });
  },
  joinGame: (gameId, username) => {
    return new Promise((resolve) => {
      const playerId = uuidv4();
      const playerSetupData: InitialPlayerSetupData = { id: playerId, name: username };
      get().setLocalPlayerId(playerId);

      get().emit(
        SocketEventName.JOIN_GAME,
        gameId,
        playerSetupData,
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve(true);
          } else {
            console.error('Failed to join game:', response.error);
            resolve(false);
          }
        }
      );
    });
  },
});

export const useGameStore = create<GameStore>(socketMiddleware(storeCreator as any));