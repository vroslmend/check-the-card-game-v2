// client/lib/actors.ts

import { fromPromise } from 'xstate';
import { socket } from '@/lib/socket';
import { 
  SocketEventName,
  type CreateGameResponse,
  type JoinGameResponse,
  type AttemptRejoinResponse,
  type InitialPlayerSetupData
} from 'shared-types';

export const createGameActor = fromPromise<CreateGameResponse, { name: string }>(
  async ({ input }) => {
    return new Promise((resolve, reject) => {
      socket.emit(SocketEventName.CREATE_GAME, input, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'Failed to create game.'));
        }
      });
    });
  }
);

export const joinGameActor = fromPromise<JoinGameResponse, { gameId: string, name: string }>(
  async ({ input }) => {
    return new Promise((resolve, reject) => {
      const playerSetupData: InitialPlayerSetupData = { name: input.name };
      // Note: The server expects two arguments for JOIN_GAME, not a single object.
      socket.emit(SocketEventName.JOIN_GAME, input.gameId, playerSetupData, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'Failed to join game.'));
        }
      });
    });
  }
);

export const rejoinActor = fromPromise<AttemptRejoinResponse, { gameId: string, playerId: string }>(
  async ({ input }) => {
    return new Promise((resolve, reject) => {
      socket.emit(SocketEventName.ATTEMPT_REJOIN, input, (response) => {
        if (response.success && response.gameState) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'Failed to rejoin.'));
        }
      });
    });
  }
);