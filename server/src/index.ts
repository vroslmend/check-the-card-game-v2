import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createActor, ActorRefFrom } from "xstate";
import dotenv from "dotenv";
import { nanoid, customAlphabet } from "nanoid";

dotenv.config();

import { gameMachine } from "./game-machine.js";
import { generatePlayerView } from "./state-redactor.js";
import logger from "./lib/logger.js";
import { FixedWindowRateLimiter } from "./lib/fixed-window-rate-limiter.js";
import {
  InitialPlayerSetupData,
  CreateGamePayload,
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
  Card,
} from "shared-types";

type GameMachineActorRef = ActorRefFrom<typeof gameMachine>;

logger.info("Server starting with Socket.IO...");

const positiveIntegerFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  logger.warn({ name, value: raw, fallback }, "Invalid limit; using fallback");
  return fallback;
};

const RESOURCE_LIMITS = {
  maxActiveGames: positiveIntegerFromEnv("MAX_ACTIVE_GAMES", 200),
  maxHttpBufferSizeBytes: positiveIntegerFromEnv(
    "MAX_HTTP_BUFFER_SIZE_BYTES",
    16 * 1024,
  ),
  createGame: {
    requests: positiveIntegerFromEnv("CREATE_GAME_RATE_LIMIT", 3),
    windowMs: positiveIntegerFromEnv(
      "CREATE_GAME_RATE_LIMIT_WINDOW_MS",
      60_000,
    ),
  },
  handshake: {
    requests: positiveIntegerFromEnv("HANDSHAKE_RATE_LIMIT", 30),
    windowMs: positiveIntegerFromEnv("HANDSHAKE_RATE_LIMIT_WINDOW_MS", 60_000),
  },
  playerAction: {
    requests: positiveIntegerFromEnv("PLAYER_ACTION_RATE_LIMIT", 60),
    windowMs: positiveIntegerFromEnv(
      "PLAYER_ACTION_RATE_LIMIT_WINDOW_MS",
      10_000,
    ),
  },
  chat: {
    requests: positiveIntegerFromEnv("CHAT_MESSAGE_RATE_LIMIT", 10),
    windowMs: positiveIntegerFromEnv(
      "CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS",
      10_000,
    ),
  },
};

const TRUST_PROXY =
  process.env.RENDER === "true" || process.env.TRUST_PROXY === "true";

logger.info(
  { resourceLimits: RESOURCE_LIMITS, trustProxy: TRUST_PROXY },
  "Resource limits set",
);

const gameCreationLimiter = new FixedWindowRateLimiter(
  RESOURCE_LIMITS.createGame.requests,
  RESOURCE_LIMITS.createGame.windowMs,
);
const handshakeLimiter = new FixedWindowRateLimiter(
  RESOURCE_LIMITS.handshake.requests,
  RESOURCE_LIMITS.handshake.windowMs,
);
const playerActionLimiter = new FixedWindowRateLimiter(
  RESOURCE_LIMITS.playerAction.requests,
  RESOURCE_LIMITS.playerAction.windowMs,
);
const chatMessageLimiter = new FixedWindowRateLimiter(
  RESOURCE_LIMITS.chat.requests,
  RESOURCE_LIMITS.chat.windowMs,
);

const rateLimiters = [
  gameCreationLimiter,
  handshakeLimiter,
  playerActionLimiter,
  chatMessageLimiter,
];
setInterval(() => {
  for (const limiter of rateLimiters) limiter.prune();
}, 60_000).unref();

const activeGameMachines = new Map<GameId, GameMachineActorRef>();
const socketSessionMap = new Map<
  string,
  { gameId: GameId; playerId: PlayerId }
>();

// Proof that a rejoining socket owns the seat it is asking for. Player ids are
// public to everyone at the table (they ride in every broadcast, and in
// turnOrder), so an id alone cannot authorise a rejoin: anyone could take over
// anyone. This never enters game state, so it cannot reach another player.
const reconnectTokens = new Map<string, string>();

// Counts broadcasts per game so a player action can be told apart from one the
// machine refused. A refused action changes nothing and emits nothing, which
// on the client is indistinguishable from a connection that has died.
const broadcastCounts = new Map<GameId, number>();
const seatKey = (gameId: GameId, playerId: PlayerId) => `${gameId}:${playerId}`;
const issueReconnectToken = (gameId: GameId, playerId: PlayerId): string => {
  const token = nanoid(32);
  reconnectTokens.set(seatKey(gameId, playerId), token);
  return token;
};

// Short, shareable lobby codes: uppercase, no lookalikes (0/O, 1/I/L).
// ~28.6M combinations at length 5; collision-checked against live games.
const LOBBY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateLobbyCode = customAlphabet(LOBBY_CODE_ALPHABET, 5);
const newGameId = (): GameId => {
  for (let i = 0; i < 5; i++) {
    const code = generateLobbyCode();
    if (!activeGameMachines.has(code)) return code;
  }
  // Practically unreachable; fall back to a long unique id.
  return nanoid(12);
};

const MAX_CHAT_MESSAGE_LENGTH = 500;
const ABANDONED_GAME_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
// How long a disconnected socket's session entry survives. Must cover the
// connectionStateRecovery window (2 min): a recovered socket returns with the
// SAME socket id and must still find its session, or every action it sends is
// dropped ("socket without a session"). Stale entries for sockets that never
// return are deleted after this delay; registerSocketSession also sweeps a
// player's old entries whenever they rejoin on a new socket.
const SESSION_RETENTION_MS = 2 * 60 * 1000 + 30_000;

// Only client-originated player actions may be forwarded into a game machine.
// Everything else (PLAYER_RECONNECTED, PLAYER_JOIN_REQUEST, timer events, ...)
// is internal and must not be spoofable through the PLAYER_ACTION socket event.
const ALLOWED_PLAYER_ACTIONS = new Set<string>(Object.values(PlayerActionType));

// Actions whose contract includes a payload. Guards inside the machine
// destructure it directly, so one arriving without it throws mid-transition,
// which stops the actor and takes the whole game down with it. Checking the
// shape here keeps a bad message a rejected message.
const ACTIONS_REQUIRING_PAYLOAD = new Set<string>([
  PlayerActionType.SWAP_AND_DISCARD,
  PlayerActionType.ATTEMPT_MATCH,
  PlayerActionType.USE_ABILITY,
  PlayerActionType.REMOVE_PLAYER,
  PlayerActionType.SEND_CHAT_MESSAGE,
]);

const stopAndRemoveGame = (gameId: GameId, reason: string) => {
  const gameActor = activeGameMachines.get(gameId);
  if (!gameActor) return;
  logger.info({ gameId, reason }, "Stopping and removing game machine");
  gameActor.stop();
  activeGameMachines.delete(gameId);
  broadcastCounts.delete(gameId);
  for (const key of reconnectTokens.keys()) {
    if (key.startsWith(`${gameId}:`)) reconnectTokens.delete(key);
  }
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

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CORS_ORIGIN = (
  process.env.CORS_ORIGIN ?? (IS_PRODUCTION ? "" : "http://localhost:3000")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (IS_PRODUCTION && CORS_ORIGIN.length === 0) {
  throw new Error(
    "CORS_ORIGIN must list at least one allowed frontend origin in production.",
  );
}

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
  // CORS only controls which browser responses may be read. Engine.IO's
  // admission hook is what refuses an unlisted WebSocket Origin before a
  // Socket.IO connection exists. This is a browser boundary, not client
  // authentication: non-browser clients can forge the header, so the resource
  // limits above remain necessary.
  allowRequest: (request, callback) => {
    if (!IS_PRODUCTION) {
      callback(null, true);
      return;
    }

    const origin = request.headers.origin;
    const allowed = typeof origin === "string" && CORS_ORIGIN.includes(origin);
    if (!allowed) {
      logger.warn(
        { origin: origin ?? null },
        "Rejected connection from an unauthorized origin",
      );
    }
    callback(null, allowed);
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes buffer
    skipMiddlewares: true, // keep auth cost low during recovery
  },
  // Client messages are names, lobby codes and small action payloads. Keeping
  // the Engine.IO default of 1 MB would allow far more parsing/allocation than
  // this protocol ever needs before application validation gets a chance.
  maxHttpBufferSize: RESOURCE_LIMITS.maxHttpBufferSizeBytes,
  // Both sides notice a dead link after pingInterval + pingTimeout, so the
  // engine.io defaults (25s + 20s) leave a player staring at a frozen board
  // for 45 seconds. Getting it wrong in this direction is the cheap mistake:
  // recovery and the reconnect grace both run for minutes, so a premature
  // disconnect costs a brief reconnecting flash and heals itself.
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL_MS || "10000", 10),
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT_MS || "8000", 10),
  // Game-state broadcasts are repetitive JSON that deflates 5-10×; slow
  // client links are the binding constraint, not server CPU. Frames under
  // 1 KB skip compression.
  perMessageDeflate: { threshold: 1024 },
});

io.on("connection", (socket: Socket) => {
  logger.info({ socketId: socket.id }, "New connection");

  // Render puts the real client address first in X-Forwarded-For. Trusting a
  // client-supplied header on a direct deployment would let callers choose
  // their own rate-limit key, so proxy headers are used only on Render or when
  // an operator explicitly enables TRUST_PROXY.
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  const forwardedClientAddress = (
    Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  )
    ?.split(",")[0]
    ?.trim();
  const clientAddress =
    (TRUST_PROXY && forwardedClientAddress) || socket.handshake.address;

  const acknowledgedRequestIsLimited = (
    limiter: FixedWindowRateLimiter,
    key: string,
    eventName: SocketEventName,
  ): boolean => {
    const result = limiter.consume(key);
    if (result.allowed) return false;
    if (result.firstRejection) {
      logger.warn(
        {
          socketId: socket.id,
          eventName,
          retryAfterMs: result.retryAfterMs,
        },
        "Socket request rate limit reached",
      );
    }
    return true;
  };

  const rejectFireAndForgetRequest = (
    limiter: FixedWindowRateLimiter,
    key: string,
    eventName: SocketEventName,
  ): boolean => {
    const result = limiter.consume(key);
    if (result.allowed) return false;
    if (result.firstRejection) {
      logger.warn(
        {
          socketId: socket.id,
          eventName,
          retryAfterMs: result.retryAfterMs,
        },
        "Socket request rate limit reached",
      );
      socket.emit(SocketEventName.ERROR_MESSAGE, {
        message: "You are sending requests too quickly. Please slow down.",
      });
    }
    return true;
  };

  const registerSocketSession = (gameId: GameId, playerId: PlayerId) => {
    // Remove any previous socketId mapped to this player
    for (const [sid, sess] of socketSessionMap.entries()) {
      if (sess.playerId !== playerId) continue;
      // A previous socket that is still open is a second client taking the
      // seat, not a reconnect after a dropped one. Only the first case has
      // anyone left to tell, and telling them is the whole fix: the takeover
      // is legitimate, the silence afterwards is not. Sent before the entry
      // goes, because after it this socket is unreachable through the session
      // map and its actions are dropped with no reply.
      if (sid !== socket.id && io.sockets.sockets.has(sid)) {
        logger.info(
          { gameId, playerId, supersededSocketId: sid, bySocketId: socket.id },
          "Seat claimed by another client; telling the one it replaces",
        );
        io.to(sid).emit(SocketEventName.SEAT_CLAIMED_ELSEWHERE);
      }
      socketSessionMap.delete(sid);
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
    broadcastCounts.set(gameId, (broadcastCounts.get(gameId) ?? 0) + 1);

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
        return;
      }
      // Skipping a player whose transport is still open is the one shape worth
      // hearing about: they sit in front of a frozen board while everyone else
      // plays on, and nothing on their side knows yet. Guarded on the live
      // socket so an ordinary departure stays silent.
      if (player.socketId && io.sockets.sockets.has(player.socketId)) {
        logger.warn(
          { gameId, playerId: player.id, socketId: player.socketId },
          "Skipped a broadcast to a player whose socket is still connected",
        );
      }
    });
  };

  // A socket restored by connection-state recovery keeps its id (and, with
  // R5.1b, its retained session) — but the machine flagged the player
  // disconnected when the transport dropped. Heal it server-side right away
  // instead of waiting for the client's ATTEMPT_REJOIN round-trip.
  if ((socket as { recovered?: boolean }).recovered) {
    const recoveredSession = socketSessionMap.get(socket.id);
    if (recoveredSession) {
      const gameActor = activeGameMachines.get(recoveredSession.gameId);
      if (gameActor?.getSnapshot().context.players[recoveredSession.playerId]) {
        logger.info(
          { socketId: socket.id, session: recoveredSession },
          "Recovered socket — restoring player connection",
        );
        gameActor.send({
          type: "PLAYER_RECONNECTED",
          playerId: recoveredSession.playerId,
          newSocketId: socket.id,
        });
        broadcastGameState(recoveredSession.gameId, gameActor);
      }
    }
  }

  socket.on(
    SocketEventName.CREATE_GAME,
    (
      playerSetupData: CreateGamePayload,
      callback: (response: CreateGameResponse) => void,
    ) => {
      try {
        if (
          acknowledgedRequestIsLimited(
            handshakeLimiter,
            clientAddress,
            SocketEventName.CREATE_GAME,
          )
        ) {
          if (callback)
            callback({
              success: false,
              message: "Too many requests. Please wait and try again.",
            });
          return;
        }

        if (getSocketSession()) {
          if (callback)
            callback({
              success: false,
              message: "Leave your current game before creating another.",
            });
          return;
        }

        if (
          acknowledgedRequestIsLimited(
            gameCreationLimiter,
            clientAddress,
            SocketEventName.CREATE_GAME,
          )
        ) {
          if (callback)
            callback({
              success: false,
              message: "Too many requests. Please wait and try again.",
            });
          return;
        }

        if (activeGameMachines.size >= RESOURCE_LIMITS.maxActiveGames) {
          logger.warn(
            { activeGames: activeGameMachines.size },
            "Create game rejected: active game limit reached",
          );
          if (callback)
            callback({
              success: false,
              message: "The server is at capacity. Please try again later.",
            });
          return;
        }

        const gameId = newGameId();
        const playerId = nanoid();
        // The host's table size, clamped server-side. Omitted or invalid
        // falls through to the machine's env default.
        const requestedSeats = Number(playerSetupData?.maxPlayers);
        const maxPlayers = Number.isInteger(requestedSeats)
          ? Math.min(6, Math.max(2, requestedSeats))
          : undefined;
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
          input: { gameId, maxPlayers },
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
          error: (err) => {
            logger.error({ err, gameId }, "Game machine error");
            // A stopped actor still answers getSnapshot, so leaving it in the
            // map hands arrivals a seat at a table that can never move again.
            // Say so and clear it out rather than let it rot.
            io.to(gameId).emit(SocketEventName.ERROR_MESSAGE, {
              message: "This game ended unexpectedly. Please start a new one.",
            });
            stopAndRemoveGame(gameId, "game machine error");
            broadcastSubscription.unsubscribe();
            chatSubscription.unsubscribe();
            directMessageSubscription.unsubscribe();
            actorSubscription.unsubscribe();
          },
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
            reconnectToken: issueReconnectToken(gameId, playerId),
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
        if (
          acknowledgedRequestIsLimited(
            handshakeLimiter,
            clientAddress,
            SocketEventName.JOIN_GAME,
          )
        ) {
          if (callback)
            callback({
              success: false,
              message: "Too many requests. Please wait and try again.",
            });
          return;
        }

        // Codes are generated uppercase; accept any casing from typed input.
        gameId = gameId.trim().toUpperCase();
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
            reconnectToken: issueReconnectToken(gameId, playerId),
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
      data: { gameId: GameId; playerId: PlayerId; token?: string },
      callback: (r: AttemptRejoinResponse) => void,
    ) => {
      try {
        if (
          acknowledgedRequestIsLimited(
            handshakeLimiter,
            clientAddress,
            SocketEventName.ATTEMPT_REJOIN,
          )
        ) {
          if (callback)
            callback({
              success: false,
              message: "Too many requests. Please wait and try again.",
            });
          return;
        }

        const { gameId, playerId, token } = data;
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

        // A player id proves nothing: every client at the table is sent every
        // other player's id in each broadcast. Only the token, which never
        // leaves the socket it was issued to, says this seat is yours.
        const expected = reconnectTokens.get(seatKey(gameId, playerId));
        if (!expected || token !== expected) {
          logger.warn(
            { gameId, playerId, socketId: socket.id, hadToken: !!token },
            "Rejected a rejoin that could not prove it owns the seat",
          );
          // Phrased to match the client's terminal-failure guard, so a stale
          // session is cleared and sent home instead of retrying on a backoff
          // that can never succeed.
          if (callback)
            callback({
              success: false,
              message: "Session not found for this game.",
            });
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
            snapshot.context.players[playerId]?.hand
              .slice(-2)
              .filter((c): c is Card => c !== null) ?? [];
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
      const rateLimitKey = session
        ? seatKey(session.gameId, session.playerId)
        : clientAddress;
      if (
        action?.type !== PlayerActionType.LEAVE_GAME &&
        rejectFireAndForgetRequest(
          playerActionLimiter,
          rateLimitKey,
          SocketEventName.PLAYER_ACTION,
        )
      ) {
        return;
      }

      if (!session) {
        logger.warn(
          { action, socketId: socket.id },
          "Player action received from socket without a session.",
        );
        return;
      }
      const gameActor = activeGameMachines.get(session.gameId);
      if (!gameActor) return;

      // The other half of the same picture: input still arriving from someone
      // the machine has written off. Their action moves the game for everyone
      // else while no result reaches them.
      if (
        !gameActor.getSnapshot().context.players[session.playerId]?.isConnected
      ) {
        logger.warn(
          {
            gameId: session.gameId,
            playerId: session.playerId,
            actionType: action?.type,
          },
          "Player action from a player the server considers disconnected",
        );
      }

      if (!action || !ALLOWED_PLAYER_ACTIONS.has(action.type)) {
        logger.warn(
          { action, socketId: socket.id },
          "Rejected player action with unknown or internal event type.",
        );
        return;
      }

      if (
        ACTIONS_REQUIRING_PAYLOAD.has(action.type) &&
        (typeof action.payload !== "object" || action.payload === null)
      ) {
        logger.warn(
          { actionType: action.type, socketId: socket.id },
          "Rejected player action missing its payload.",
        );
        return;
      }

      logger.debug(
        { action, gameId: session.gameId, playerId: session.playerId },
        "Player action received",
      );

      if (action.type === PlayerActionType.SEND_CHAT_MESSAGE) {
        if (
          rejectFireAndForgetRequest(
            chatMessageLimiter,
            rateLimitKey,
            SocketEventName.SEND_CHAT_MESSAGE,
          )
        ) {
          return;
        }
        sendChatAsSessionPlayer(gameActor, session, action.payload?.message);
        return;
      }

      const broadcastsBefore = broadcastCounts.get(session.gameId) ?? 0;

      gameActor.send({
        type: action.type,
        payload: action.payload,
        playerId: session.playerId,
      } as any);

      // An action every guard refused changes nothing and broadcasts nothing,
      // so the player is left waiting on an answer that will never come and
      // their client eventually mistakes the silence for a dead connection.
      // Send them the unchanged view so the wait ends now.
      if ((broadcastCounts.get(session.gameId) ?? 0) === broadcastsBefore) {
        io.to(socket.id).emit(
          SocketEventName.GAME_STATE_UPDATE,
          generatePlayerView(gameActor.getSnapshot(), session.playerId),
        );
      }

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
      const rateLimitKey = session
        ? seatKey(session.gameId, session.playerId)
        : clientAddress;
      if (
        rejectFireAndForgetRequest(
          chatMessageLimiter,
          rateLimitKey,
          SocketEventName.SEND_CHAT_MESSAGE,
        )
      ) {
        return;
      }

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
      // Deleting immediately would orphan a connection-state-recovered
      // socket (same id, session gone). Keep the entry for the recovery
      // window; drop it later only if this socket never came back.
      setTimeout(() => {
        const current = socketSessionMap.get(socket.id);
        if (current === session && !io.sockets.sockets.has(socket.id)) {
          socketSessionMap.delete(socket.id);
        }
      }, SESSION_RETENTION_MS).unref();
    }
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Server listening");
});
