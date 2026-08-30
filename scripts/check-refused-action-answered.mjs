// Guards that a player always gets an answer. Every accepted action ends in a
// broadcast, so the client treats silence after a move as evidence the
// connection has died and re-runs the rejoin handshake. An action the machine
// REFUSES is also silent, and used to be indistinguishable from that.
//
// The trap is that refusals are normal. A guard turns one down whenever the UI
// and the server disagree for a moment, which is exactly what a turn timer
// expiring under a player's click produces. Left unanswered, an ordinary
// refused click looks like a broken connection.
//
// Drives the real compiled server over real sockets.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PORT = "8173";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.LOBBY_DISCONNECT_TIMEOUT_MS = "600000";

const { io: ioc } = await import("socket.io-client");
const { httpServer } = await import("../server/dist/index.js");

const URL = "http://127.0.0.1:8173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const connect = () =>
  new Promise((resolve) => {
    const s = ioc(URL, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Origin: "http://localhost:3000" },
    });
    s.on("connect", () => resolve(s));
  });

const alice = await connect();
const bob = await connect();

let bobStates = 0;
let aliceStates = 0;
bob.on("GAME_STATE_UPDATE", () => bobStates++);
alice.on("GAME_STATE_UPDATE", () => aliceStates++);

const created = await new Promise((res) =>
  alice.emit("CREATE_GAME", { name: "Alice", maxPlayers: 2 }, res),
);
await new Promise((res) =>
  bob.emit("JOIN_GAME", created.gameId, { name: "Bob" }, res),
);
await sleep(300);

console.log("\nAn action the machine refuses still gets an answer:");

// Bob is not the game master and nobody is ready, so START_GAME is refused by
// and(["isGameMaster", "areAllPlayersReady"]). Nothing changes, nothing is
// broadcast to the table.
let before = bobStates;
bob.emit("PLAYER_ACTION", { type: "START_GAME" });
await sleep(400);
check(
  "a refused action answers the player who sent it",
  bobStates - before > 0,
  `Bob gained ${bobStates - before}`,
);

// Alice is the game master but not everyone is ready, so this is refused too.
before = aliceStates;
alice.emit("PLAYER_ACTION", { type: "START_GAME" });
await sleep(400);
check(
  "the game master gets an answer when refused too",
  aliceStates - before > 0,
  `Alice gained ${aliceStates - before}`,
);

// And the state it answers with is still the lobby, not a started game.
const stage = await new Promise((res) => {
  const once = (gs) => {
    bob.off("GAME_STATE_UPDATE", once);
    res(gs.gameStage);
  };
  bob.on("GAME_STATE_UPDATE", once);
  bob.emit("PLAYER_ACTION", { type: "DECLARE_LOBBY_READY" });
});
check(
  "a refused start left the game in the lobby",
  stage === "WAITING_FOR_PLAYERS",
  `stage is ${stage}`,
);

console.log("\nAccepted actions are unaffected:");
before = bobStates;
bob.emit("PLAYER_ACTION", { type: "DECLARE_LOBBY_UNREADY" });
await sleep(400);
check(
  "an accepted action still broadcasts to the table",
  bobStates - before > 0,
  `Bob gained ${bobStates - before}`,
);

alice.close();
bob.close();
httpServer.close();

if (failures > 0) {
  console.error(`
${failures} refused-action failure${failures === 1 ? "" : "s"}.

A player who gets no answer cannot tell a refused click from a dead
connection, and the client will eventually give up on a working socket and
re-handshake for nothing. Treat a failure here as the server being wrong
rather than this script.`);
  process.exit(1);
}

console.log("\nEvery action is answered, accepted or not.");
process.exit(0);
