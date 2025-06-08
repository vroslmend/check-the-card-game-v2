import type { Socket } from 'socket.io-client';
import type {
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
} from 'shared-types';

export interface SocketState {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
}

export interface GameStore extends SocketState {
  gameId: string | null;
  currentGameState: ClientCheckGameState | null;
  localPlayerId: string | null;
  gameLog: RichGameLogMessage[];
  chatMessages: ChatMessage[];
  isSidePanelOpen: boolean;
  handleGameStateUpdate: (payload: { gameId: string; gameState: ClientCheckGameState }) => void;
  setLocalPlayerId: (id: string | null) => void;
  addLogMessage: (logMessage: RichGameLogMessage) => void;
  addChatMessage: (chatMessage: ChatMessage) => void;
  toggleSidePanel: () => void;
  resetGameStore: () => void;
  createGame: (username: string) => Promise<string | null>;
  joinGame: (gameId: string, username: string) => Promise<boolean>;
}