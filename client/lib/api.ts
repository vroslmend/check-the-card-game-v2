import type { Socket } from 'socket.io-client';
import { SocketEventName } from 'shared-types';
import type { CreateGameResponse, JoinGameResponse } from 'shared-types';

export const createGame = (
  socket: Socket,
  playerName: string
): Promise<CreateGameResponse> => {
  return new Promise((resolve) => {
    socket.emit(
      SocketEventName.CREATE_GAME,
      { name: playerName },
      (response: CreateGameResponse) => {
        resolve(response);
      }
    );
  });
};

export const joinGame = (
  socket: Socket,
  gameId: string,
  playerName: string
): Promise<JoinGameResponse> => {
  return new Promise((resolve) => {
    socket.emit(
      SocketEventName.JOIN_GAME,
      { gameId, playerSetupData: { name: playerName } },
      (response: JoinGameResponse) => {
        resolve(response);
      }
    );
  });
}; 