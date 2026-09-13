// Guards the server process against a client turning cheap socket messages
// into unbounded state machines or event processing. This drives the compiled
// server over real Socket.IO connections because the boundary being protected
// includes Engine.IO message sizing, proxy-derived client identity and the
// acknowledgement paths the browser actually sees.
//
// Run from the repo root, after npm run build:server-deps.

import { sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";

const server = await startServer({
  TRUST_PROXY: true,
  MAX_ACTIVE_GAMES: 2,
  MAX_HTTP_BUFFER_SIZE_BYTES: 1024,
  CREATE_GAME_RATE_LIMIT: 1,
  CREATE_GAME_RATE_LIMIT_WINDOW_MS: 60_000,
  HANDSHAKE_RATE_LIMIT: 3,
  HANDSHAKE_RATE_LIMIT_WINDOW_MS: 60_000,
  PLAYER_ACTION_RATE_LIMIT: 3,
  PLAYER_ACTION_RATE_LIMIT_WINDOW_MS: 60_000,
  CHAT_MESSAGE_RATE_LIMIT: 2,
  CHAT_MESSAGE_RATE_LIMIT_WINDOW_MS: 60_000,
});
const { check, finish } = createReport();

// Each connection claims its own client address, which the server trusts here
// because TRUST_PROXY is on.
const connect = async (name, address) => {
  const player = server.player(name, {
    headers: { "x-forwarded-for": address },
  });
  await player.connected();
  return player;
};

const createGame = (player, name) =>
  player.request("CREATE_GAME", { name, maxPlayers: 2 });
const joinGame = (player, gameId, name) =>
  player.request("JOIN_GAME", gameId, { name });

try {
  const alice = await connect("Alice", "203.0.113.1");
  const bob = await connect("Bob", "203.0.113.2");
  const charlie = await connect("Charlie", "203.0.113.3");
  const dana = await connect("Dana", "203.0.113.1");

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

  alice.act("LEAVE_GAME");
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
  bob.socket.on("ERROR_MESSAGE", (error) => errors.push(error.message));
  bob.socket.on("NEW_CHAT_MESSAGE", (message) => chats.push(message.message));

  for (let i = 0; i < 4; i++) {
    bob.act("DECLARE_LOBBY_READY");
  }
  await sleep(50);
  check(
    "player actions beyond the budget are rejected visibly",
    errors.some((message) => /too quickly/i.test(message)),
    JSON.stringify(errors),
  );

  for (let i = 0; i < 3; i++) {
    bob.socket.emit("SEND_CHAT_MESSAGE", { message: `message ${i}` });
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

  const eve = await connect("Eve", "203.0.113.4");
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
    server.io.engine.opts.maxHttpBufferSize === 1024,
    `bytes=${server.io.engine.opts.maxHttpBufferSize}`,
  );

  const frank = await connect("Frank", "203.0.113.5");
  const closedForOversizeMessage = new Promise((resolve) => {
    frank.socket.once("disconnect", () => resolve(true));
    setTimeout(() => resolve(false), 1000);
  });
  frank.socket.emit("SEND_CHAT_MESSAGE", { message: "x".repeat(2048) });
  check(
    "an oversized inbound message closes the transport",
    await closedForOversizeMessage,
  );
} finally {
  await server.close();
}

finish({
  passed: () =>
    "\nGame allocation and socket work stay within explicit limits.",
  failed: (failures) => `
${failures} resource-limit check${failures === 1 ? "" : "s"} failed.

One client must not be able to allocate unbounded game actors or make the
server process an unlimited event stream. Treat a failure here as a production
availability regression.`,
});
