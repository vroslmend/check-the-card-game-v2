import { fromPromise } from "xstate";
import { socket } from "@/lib/socket";
import {
  SocketEventName,
  type CreateGameResponse,
  type JoinGameResponse,
  type AttemptRejoinResponse,
  type InitialPlayerSetupData,
} from "shared-types";

// The ack timer starts when the packet is created, not when it is sent, so
// this has to cover a cold start: the emit waits in socket.io's buffer until
// the server is awake and the connection is up. A drop mid-flight does not
// wait for it, because a timed emit is errored the moment the socket closes.
const HANDSHAKE_TIMEOUT_MS = 60_000;
const NO_ANSWER =
  "The server did not answer. Check your connection and try again.";

export const createGameActor = fromPromise<
  CreateGameResponse,
  { name: string; maxPlayers?: number }
>(async ({ input }) => {
  return new Promise((resolve, reject) => {
    socket
      .timeout(HANDSHAKE_TIMEOUT_MS)
      .emit(SocketEventName.CREATE_GAME, input, (err, response) => {
        if (err) return reject(new Error(NO_ANSWER));
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || "Failed to create game."));
        }
      });
  });
});

export const joinGameActor = fromPromise<
  JoinGameResponse,
  { gameId: string; name: string }
>(async ({ input }) => {
  return new Promise((resolve, reject) => {
    const playerSetupData: InitialPlayerSetupData = { name: input.name };
    socket
      .timeout(HANDSHAKE_TIMEOUT_MS)
      .emit(
        SocketEventName.JOIN_GAME,
        input.gameId,
        playerSetupData,
        (err, response) => {
          if (err) return reject(new Error(NO_ANSWER));
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.message || "Failed to join game."));
          }
        },
      );
  });
});

export const rejoinActor = fromPromise<
  AttemptRejoinResponse,
  { gameId: string; playerId: string; token?: string }
>(async ({ input }) => {
  return new Promise((resolve, reject) => {
    socket
      .timeout(HANDSHAKE_TIMEOUT_MS)
      .emit(SocketEventName.ATTEMPT_REJOIN, input, (err, response) => {
        if (err) return reject(new Error(NO_ANSWER));
        if (response.success && response.gameState) {
          resolve(response);
        } else {
          reject(new Error(response.message || "Failed to rejoin."));
        }
      });
  });
});
