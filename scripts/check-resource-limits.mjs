// Guards the server process against a client turning cheap socket messages
// into unbounded state machines or event processing. This drives the compiled
// server over real Socket.IO connections because the boundary being protected
// includes Engine.IO message sizing, proxy-derived client identity and the
// acknowledgement paths the browser actually sees.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PORT = "8231";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.TRUST_PROXY = "true";
process.env.MAX_ACTIVE_GAMES = "2";
process.env.MAX_HTTP_BUFFER_SIZE_BYTES = "1024";
process.env.CREATE_GAME_RATE_LIMIT = "1";
process.env.CREATE_GAME_RATE_LIMIT_WINDOW_MS = "60000";
process.env.HANDSHAKE_RATE_LIMIT = "3";
process.env.HANDSHAKE_RATE_LIMIT_WINDOW_MS = "60000";
process.env.PLAYER_ACTION_RATE_LIMIT = "3";
process.env.PLAYER_ACTION_RATE_LIMIT_WINDOW_MS = "60000";
process.env.CHAT_MESSAGE_RATE_LIMIT = "2";
process.env.CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS = "60000";

const { io: ioc } = await import("socket.io-client");
const { httpServer, io } = await import("../server/dist/index.js");

const URL = "http://127.0.0.1:8231";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const sockets = [];
const connect = (address) =>
  new Promise((resolve, reject) => {
    const socket = ioc(URL, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: {
        Origin: "http://localhost:3000",
        "x-forwarded-for": address,
      },
    });
    const onError = (error) => reject(error);
    socket.once("connect_error", onError);
    socket.once("connect", () => {
      socket.off("connect_error", onError);
      sockets.push(socket);
      resolve(socket);
    });
  });

const createGame = (socket, name) =>
  new Promise((resolve) =>
    socket.emit("CREATE_GAME", { name, maxPlayers: 2 }, resolve),
  );
const joinGame = (socket, gameId, name) =>
  new Promise((resolve) => socket.emit("JOIN_GAME", gameId, { name }, resolve));

try {
  const alice = await connect("203.0.113.1");
  const bob = await connect("203.0.113.2");
  const charlie = await connect("203.0.113.3");
  const dana = await connect("203.0.113.1");

  console.log("\nGame allocation is bounded:");
  const aliceGame = await createGame(alice, "Alice");
  check("the first game can be created", aliceGame.success === true);

  const duplicate = await createGame(alice, "Alice again");
  check(
    "one socket cannot own a second game",
    duplicate.success === false &&
      /current game/i.test(duplicate.message ?? ""),
    duplicate.message,
  );

  const bobGame = await createGame(bob, "Bob");
  check("a second game can be created", bobGame.success === true);

  const capacity = await createGame(charlie, "Charlie");
  check(
    "the active-game ceiling rejects another machine",
    capacity.success === false && /capacity/i.test(capacity.message ?? ""),
    capacity.message,
  );

  alice.emit("PLAYER_ACTION", { type: "LEAVE_GAME" });
  await sleep(50);
  const reconnectEvasion = await createGame(dana, "Dana");
  check(
    "fresh sockets still share the per-IP creation budget",
    reconnectEvasion.success === false &&
      /too many requests/i.test(reconnectEvasion.message ?? ""),
    reconnectEvasion.message,
  );

  console.log("\nHigh-frequency event work is bounded:");
  const errors = [];
  const chats = [];
  bob.on("ERROR_MESSAGE", (error) => errors.push(error.message));
  bob.on("NEW_CHAT_MESSAGE", (message) => chats.push(message.message));

  for (let i = 0; i < 4; i++) {
    bob.emit("PLAYER_ACTION", { type: "DECLARE_LOBBY_READY" });
  }
  await sleep(50);
  check(
    "player actions beyond the budget are rejected visibly",
    errors.some((message) => /too quickly/i.test(message)),
    JSON.stringify(errors),
  );

  for (let i = 0; i < 3; i++) {
    bob.emit("SEND_CHAT_MESSAGE", { message: `message ${i}` });
  }
  await sleep(50);
  check(
    "chat accepts only its configured budget",
    chats.length === 2,
    `accepted=${chats.length}`,
  );
  check(
    "chat limiting is reported without an error flood",
    errors.length === 2,
    JSON.stringify(errors),
  );

  const eve = await connect("203.0.113.4");
  const joins = [];
  for (let i = 0; i < 4; i++) {
    joins.push(await joinGame(eve, "NOPE1", "Eve"));
  }
  check(
    "join/rejoin handshakes have a combined per-IP budget",
    joins[3].success === false &&
      /too many requests/i.test(joins[3].message ?? ""),
    joins.map((response) => response.message).join(" | "),
  );

  check(
    "Engine.IO uses the configured inbound message ceiling",
    io.engine.opts.maxHttpBufferSize === 1024,
    `bytes=${io.engine.opts.maxHttpBufferSize}`,
  );

  const frank = await connect("203.0.113.5");
  const closedForOversizeMessage = new Promise((resolve) => {
    frank.once("disconnect", () => resolve(true));
    setTimeout(() => resolve(false), 1000);
  });
  frank.emit("SEND_CHAT_MESSAGE", { message: "x".repeat(2048) });
  check(
    "an oversized inbound message closes the transport",
    await closedForOversizeMessage,
  );
} finally {
  for (const socket of sockets) socket.close();
  await new Promise((resolve) => httpServer.close(resolve));
}

if (failures > 0) {
  console.error(`
${failures} resource-limit check${failures === 1 ? "" : "s"} failed.

One client must not be able to allocate unbounded game actors or make the
server process an unlimited event stream. Treat a failure here as a production
availability regression.`);
  process.exit(1);
}

console.log("\nGame allocation and socket work stay within explicit limits.");
process.exit(0);
