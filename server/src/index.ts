import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createActor, ActorRefFrom } from "xstate";
import dotenv from "dotenv";
import { nanoid } from "nanoid";

dotenv.config();

import { gameMachine } from "./game-machine.js";
import { generatePlayerView } from "./state-redactor.js";
import logger from "./lib/logger.js";
import {
  InitialPlayerSetupData,
  PlayerActionType,
  CreateGameResponse,
  JoinGameResponse,
  SocketEventName,
  PlayerId,
  GameId,
  GameStage,
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
  AttemptRejoinResponse,
} from "shared-types";

type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;

logger.info("Server starting with Socket.IO...");

const activeGameMachines = new Map<GameId, GameMachineActorRef>();
const socketSessionMap = new Map<
  string,
  { gameId: GameId; playerId: PlayerId }
>();

const MAX_CHAT_MESSAGE_LENGTH = 500;
const ABANDONED_GAME_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

// Only client-originated player actions may be forwarded into a game machine.
// Everything else (PLAYER_RECONNECTED, PLAYER_JOIN_REQUEST, timer events, ...)
// is internal and must not be spoofable through the PLAYER_ACTION socket event.
const ALLOWED_PLAYER_ACTIONS = new Set<string>(Object.values(PlayerActionType));

const stopAndRemoveGame = (gameId: GameId, reason: string) => {
  const gameActor = activeGameMachines.get(gameId);
  if (!gameActor) return;
  logger.info({ gameId, reason }, "Stopping and removing game machine");
  gameActor.stop();
  activeGameMachines.delete(gameId);
};

const cleanupGameIfEmpty = (gameId: GameId) => {
  const gameActor = activeGameMachines.get(gameId);
  if (!gameActor) return;
  if (Object.keys(gameActor.getSnapshot().context.players).length === 0) {
    stopAndRemoveGame(gameId, "no players remain");
  }
};

// Periodic sweep so fully-abandoned mid-game machines don't leak forever.
// A game is only removed after two consecutive sweeps with nobody connected,
// so a brief everyone-is-refreshing window can't kill a live game.
const abandonedGameStrikes = new Set<GameId>();
setInterval(() => {
  for (const [gameId, gameActor] of activeGameMachines.entries()) {
    const players = Object.values(gameActor.getSnapshot().context.players);
    const abandoned =
      players.length === 0 || players.every((p) => !p.isConnected);
    if (!abandoned) {
      abandonedGameStrikes.delete(gameId);
    } else if (abandonedGameStrikes.has(gameId)) {
      abandonedGameStrikes.delete(gameId);
      stopAndRemoveGame(gameId, "abandoned by all players");
    } else {
      abandonedGameStrikes.add(gameId);
    }
  }
}, ABANDONED_GAME_SWEEP_INTERVAL_MS).unref();

const sanitizeChatMessage = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const message = raw.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  return message.length > 0 ? message : null;
};

const CORS_ORIGIN = (
  process.env.CORS_ORIGIN ??
  "http://localhost:3000,https://check-the-game.vercel.app"
)
  .split(",")
  .map((o) => o.trim());

logger.info({ corsOrigins: CORS_ORIGIN }, "CORS origins set");

export const httpServer = http.createServer((req, res) => {
  // Health check endpoint for Render
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  // Fallback for other requests
  res.writeHead(404);
  res.end();
});
export const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes buffer
    skipMiddlewares: true, // keep auth cost low during recovery
  },
});

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "New connection");

  const registerSocketSession = (gameId: GameId, playerId: PlayerId) => {
    // Remove any previous socketId mapped to this player
    for (const [sid, sess] of socketSessionMap.entries()) {
      if (sess.playerId === playerId) socketSessionMap.delete(sid);
    }
    socketSessionMap.set(socket.id, { gameId, playerId });
  };

  const getSocketSession = () => {
    return socketSessionMap.get(socket.id);
  };

  const broadcastGameState = (
    gameId: GameId,
    gameActor: GameMachineActorRef,
  ) => {
    const snapshot = gameActor.getSnapshot();

    logger.debug(
      {
        gameId,
        players: Object.keys(snapshot.context.players),
      },
      "Broadcasting game state (player-centric)",
    );

    Object.values(snapshot.context.players).forEach((player) => {
      if (player.socketId && player.isConnected) {
        io.to(player.socketId).emit(
          SocketEventName.GAME_STATE_UPDATE,
          generatePlayerView(snapshot, player.id),
        );
      }
    });
  };

  socket.on(
    SocketEventName.CREATE_GAME,
    (
      playerSetupData: InitialPlayerSetupData,
      callback: (response: CreateGameResponse) => void,
    ) => {
      try {
        const gameId = nanoid(6);
        const playerId = nanoid();
        const finalPlayerSetupData = {
          ...playerSetupData,
          id: playerId,
          socketId: socket.id,
        };

        logger.info(
          { gameId, playerId, playerName: playerSetupData.name },
          "Creating game",
        );

        const gameActor = createActor(gameMachine, {
          input: { gameId },
        });

        // General listener for broadcasting game state to all in the room
        const broadcastSubscription = gameActor.on(
          "BROADCAST_GAME_STATE",
          () => {
            broadcastGameState(gameId, gameActor);
          },
        );

        // General listener for broadcasting chat messages
        const chatSubscription = gameActor.on(
          "BROADCAST_CHAT_MESSAGE",
          (event) => {
            io.to(gameId).emit(
              SocketEventName.NEW_CHAT_MESSAGE,
              event.chatMessage,
            );
          },
        );

        // General listener for sending a specific event to a single player
        const directMessageSubscription = gameActor.on(
          "SEND_EVENT_TO_PLAYER",
          (event) => {
            const {
              playerId: targetPlayerId,
              eventName,
              eventData,
            } = event.payload;
            const targetPlayer =
              gameActor.getSnapshot().context.players[targetPlayerId];
            if (targetPlayer?.socketId && targetPlayer.isConnected) {
              io.to(targetPlayer.socketId).emit(
                eventName as any,
                eventData as any,
              );
            }
          },
        );

        const actorSubscription = gameActor.subscribe({
          error: (err) => logger.error({ err, gameId }, "Game machine error"),
          complete: () => {
            logger.info({ gameId }, "Game machine has completed.");
            activeGameMachines.delete(gameId);
            broadcastSubscription.unsubscribe();
            chatSubscription.unsubscribe();
            directMessageSubscription.unsubscribe();
            actorSubscription.unsubscribe();
          },
        });

        gameActor.start();
        activeGameMachines.set(gameId, gameActor);
        socket.join(gameId);
        registerSocketSession(gameId, playerId);

        gameActor.send({
          type: "PLAYER_JOIN_REQUEST",
          playerSetupData: finalPlayerSetupData,
          playerId,
        });

        // XState processes events synchronously; if the join was accepted the
        // player exists in the snapshot now.
        if (!gameActor.getSnapshot().context.players[playerId]) {
          stopAndRemoveGame(gameId, "creator could not join own game");
          if (callback)
            callback({ success: false, message: "Failed to create game." });
          return;
        }

        if (callback) {
          callback({
            success: true,
            gameId,
            playerId,
            gameState: generatePlayerView(gameActor.getSnapshot(), playerId),
          });
        }
      } catch (e: any) {
        logger.error({ err: e }, `[Server-CreateGame] Error`);
        if (callback)
          callback({
            success: false,
            message: `Server error: ${e.message || "Unknown error"}`,
          });
      }
    },
  );

  socket.on(
    SocketEventName.JOIN_GAME,
    (
      gameId: string,
      playerSetupData: InitialPlayerSetupData,
      callback: (response: JoinGameResponse) => void,
    ) => {
      try {
        const gameActor = activeGameMachines.get(gameId);

        if (!playerSetupData) {
          logger.error(
            { gameId, socketId: socket.id },
            "Join failed: playerSetupData is missing.",
          );
          if (callback)
            callback({ success: false, message: "Player data is missing." });
          return;
        }

        logger.info(
          { gameId, playerName: playerSetupData.name, socketId: socket.id },
          "Player attempting to join game",
        );

        if (!gameActor) {
          logger.warn({ gameId }, "Join failed: game not found.");
          if (callback)
            callback({ success: false, message: "Game not found." });
          return;
        }

        const currentState = gameActor.getSnapshot();
        if (currentState.context.gameStage !== GameStage.WAITING_FOR_PLAYERS) {
          logger.warn(
            { gameId, currentState: currentState.value },
            "Join failed: game has already started.",
          );
          if (callback)
            callback({ success: false, message: "Game has already started." });
          return;
        }

        if (
          Object.keys(currentState.context.players).length >=
          currentState.context.maxPlayers
        ) {
          logger.warn(
            {
              gameId,
              playerCount: Object.keys(currentState.context.players).length,
            },
            "Join failed: game is full.",
          );
          if (callback) callback({ success: false, message: "Game is full." });
          return;
        }

        const playerId = nanoid();
        const finalPlayerSetupData = {
          ...playerSetupData,
          id: playerId,
          socketId: socket.id,
        };

        gameActor.send({
          type: "PLAYER_JOIN_REQUEST",
          playerSetupData: finalPlayerSetupData,
          playerId,
        });

        // The machine may still refuse the join (e.g. two players raced for
        // the last free seat). Never leave the client hanging without a reply.
        if (!gameActor.getSnapshot().context.players[playerId]) {
          if (callback)
            callback({ success: false, message: "Could not join the game." });
          return;
        }

        socket.join(gameId);
        registerSocketSession(gameId, playerId);

        if (callback) {
          callback({
            success: true,
            gameId,
            playerId,
            gameState: generatePlayerView(gameActor.getSnapshot(), playerId),
          });
        }
      } catch (e: any) {
        logger.error({ err: e }, `[Server-JoinGame] Error`);
        if (callback)
          callback({
            success: false,
            message: `Server error: ${e.message || "Unknown error"}`,
          });
      }
    },
  );

  socket.on(
    SocketEventName.ATTEMPT_REJOIN,
    (
      data: { gameId: GameId; playerId: PlayerId },
      callback: (r: AttemptRejoinResponse) => void,
    ) => {
      try {
        const { gameId, playerId } = data;
        const gameActor = activeGameMachines.get(gameId);

        if (!gameActor) {
          logger.warn(
            { gameId, playerId },
            "Attempted rejoin for non-existent game",
          );
          if (callback)
            callback({ success: false, message: "Game not found." });
          return;
        }

        if (!gameActor.getSnapshot().context.players[playerId]) {
          logger.warn(
            { gameId, playerId },
            "Attempted rejoin for a player not in this game",
          );
          if (callback)
            callback({ success: false, message: "Player not found." });
          return;
        }

        logger.info(
          { playerId, gameId, newSocketId: socket.id },
          "Player attempting to rejoin game",
        );

        socket.join(gameId);
        registerSocketSession(gameId, playerId);

        gameActor.send({
          type: "PLAYER_RECONNECTED",
          playerId,
          newSocketId: socket.id,
        });

        const snapshot = gameActor.getSnapshot();
        const playerSpecificView = generatePlayerView(snapshot, playerId);
        if (callback) {
          callback({
            success: true,
            gameState: playerSpecificView,
            logs: snapshot.context.log,
          });
        }

        broadcastGameState(gameId, gameActor);

        // If the player reconnects during INITIAL_PEEK they may have missed the private
        // INITIAL_PEEK_INFO packet.  Re-emit it so their client can flip the two cards.
        if (snapshot.context.gameStage === GameStage.INITIAL_PEEK) {
          const peekHand =
            snapshot.context.players[playerId]?.hand.slice(-2) ?? [];
          if (peekHand.length > 0) {
            io.to(socket.id).emit(SocketEventName.INITIAL_PEEK_INFO, {
              hand: peekHand,
            });
          }
        }
      } catch (e: any) {
        logger.error({ err: e }, `[Server-Rejoin] Error`);
        if (callback)
          callback({
            success: false,
            message: `Server error: ${e.message || "Unknown error"}`,
          });
      }
    },
  );

  // Builds a trusted chat event: sender identity always comes from the
  // socket's session, never from the client payload, so names/ids cannot be
  // spoofed.
  const sendChatAsSessionPlayer = (
    gameActor: GameMachineActorRef,
    session: { gameId: GameId; playerId: PlayerId },
    rawMessage: unknown,
  ) => {
    const message = sanitizeChatMessage(rawMessage);
    if (!message) return;
    const sender = gameActor.getSnapshot().context.players[session.playerId];
    if (!sender) return;
    gameActor.send({
      type: PlayerActionType.SEND_CHAT_MESSAGE,
      payload: {
        message,
        senderId: sender.id,
        senderName: sender.name,
      },
    });
  };

  socket.on(
    SocketEventName.PLAYER_ACTION,
    (action: { type: PlayerActionType; payload?: any }) => {
      const session = getSocketSession();
      if (!session) {
        logger.warn(
          { action, socketId: socket.id },
          "Player action received from socket without a session.",
        );
        return;
      }
      const gameActor = activeGameMachines.get(session.gameId);
      if (!gameActor) return;

      if (!action || !ALLOWED_PLAYER_ACTIONS.has(action.type)) {
        logger.warn(
          { action, socketId: socket.id },
          "Rejected player action with unknown or internal event type.",
        );
        return;
      }

      logger.debug(
        { action, gameId: session.gameId, playerId: session.playerId },
        "Player action received",
      );

      if (action.type === PlayerActionType.SEND_CHAT_MESSAGE) {
        sendChatAsSessionPlayer(gameActor, session, action.payload?.message);
        return;
      }

      gameActor.send({
        type: action.type,
        payload: action.payload,
        playerId: session.playerId,
      } as any);

      if (action.type === PlayerActionType.LEAVE_GAME) {
        socketSessionMap.delete(socket.id);
        socket.leave(session.gameId);
        cleanupGameIfEmpty(session.gameId);
      }
    },
  );

  socket.on(
    SocketEventName.SEND_CHAT_MESSAGE,
    (payload: Omit<ChatMessage, "id" | "timestamp">) => {
      const session = getSocketSession();
      if (!session) {
        logger.warn(
          { payload, socketId: socket.id },
          "Chat message received from socket without a session.",
        );
        return;
      }
      const gameActor = activeGameMachines.get(session.gameId);
      if (gameActor) {
        sendChatAsSessionPlayer(gameActor, session, payload?.message);
      }
    },
  );

  socket.on("disconnect", () => {
    const session = getSocketSession();
    logger.info({ socketId: socket.id, session }, "Connection disconnected");
    if (session) {
      const gameActor = activeGameMachines.get(session.gameId);
      if (gameActor) {
        gameActor.send({
          type: "PLAYER_DISCONNECTED",
          playerId: session.playerId,
        });
      }
      socketSessionMap.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Server listening");
});
