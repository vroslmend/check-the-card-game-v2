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

import { sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";

const server = await startServer({ LOBBY_DISCONNECT_TIMEOUT_MS: 600_000 });
const { check, finish } = createReport();

const alice = server.player("Alice");
const bob = server.player("Bob");

let bobStates = 0;
let aliceStates = 0;
bob.on(() => bobStates++);
alice.on(() => aliceStates++);

const gameId = await alice.createGame({ seats: 2 });
await bob.joinGame(gameId);
await sleep(300);

console.log("\nAn action the machine refuses still gets an answer:");

// Bob is not the game master and nobody is ready, so START_GAME is refused by
// and(["isGameMaster", "areAllPlayersReady"]). Nothing changes, nothing is
// broadcast to the table.
let before = bobStates;
bob.act("START_GAME");
await sleep(400);
check(
  "a refused action answers the player who sent it",
  bobStates - before > 0,
  `Bob gained ${bobStates - before}`,
);

// Alice is the game master but not everyone is ready, so this is refused too.
before = aliceStates;
alice.act("START_GAME");
await sleep(400);
check(
  "the game master gets an answer when refused too",
  aliceStates - before > 0,
  `Alice gained ${aliceStates - before}`,
);

// And the state it answers with is still the lobby, not a started game.
const stage = await new Promise((resolve) => {
  const once = (state) => {
    bob.off(once);
    resolve(state.gameStage);
  };
  bob.on(once);
  bob.act("DECLARE_LOBBY_READY");
});
check(
  "a refused start left the game in the lobby",
  stage === "WAITING_FOR_PLAYERS",
  `stage is ${stage}`,
);

console.log("\nAccepted actions are unaffected:");
before = bobStates;
bob.act("DECLARE_LOBBY_UNREADY");
await sleep(400);
check(
  "an accepted action still broadcasts to the table",
  bobStates - before > 0,
  `Bob gained ${bobStates - before}`,
);

await server.close();

finish({
  passed: () => "\nEvery action is answered, accepted or not.",
  failed: (failures) => `
${failures} refused-action failure${failures === 1 ? "" : "s"}.

A player who gets no answer cannot tell a refused click from a dead
connection, and the client will eventually give up on a working socket and
re-handshake for nothing. Treat a failure here as the server being wrong
rather than this script.`,
});
