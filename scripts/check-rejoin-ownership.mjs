// Guards who is allowed to reclaim a seat. Reconnecting is the one operation
// that hands a socket somebody's identity, and every player id in a game is
// public: generatePlayerView puts `id` on every entry of `players`, and
// turnOrder is a list of raw ids. So an id can never be the thing that
// authorises a rejoin, or any player could take any other player's seat, and
// the victim would be silenced with no way to tell why.
//
// The trap runs both ways. Tightening this guard far enough to stop a takeover
// also breaks ordinary reconnection, which is the single most exercised
// recovery path in the game: every phone screen-lock and every wifi blip goes
// through it. So both properties are asserted here, and a change that trades
// one for the other fails.
//
// Drives the real compiled server over a real socket, not a reimplementation.
//
// Run from the repo root, after npm run build:server-deps.

import { sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";

const server = await startServer({ LOBBY_DISCONNECT_TIMEOUT_MS: 600_000 });
const { check, finish } = createReport();

const rejoinAs = (player, payload) => player.request("ATTEMPT_REJOIN", payload);

const alice = server.player("Alice");
const bob = server.player("Bob");

let aliceStates = 0;
alice.on(() => aliceStates++);

const gameId = await alice.createGame({ seats: 2 });
await bob.joinGame(gameId);
await sleep(250);

console.log("\nSeats are issued a token that never appears in game state:");
check("creating a game returns a reconnect token", !!alice.reconnectToken);
check("joining a game returns a reconnect token", !!bob.reconnectToken);
check(
  "the token is not in any player view",
  !JSON.stringify(bob.state ?? {}).includes(
    alice.reconnectToken ?? String.fromCharCode(0),
  ),
);

console.log("\nA seat cannot be taken with a public id:");
// Bob can read Alice's id from the state he is legitimately sent.
const aliceId = Object.keys(bob.state?.players ?? {}).find(
  (id) => id === alice.id,
);
check("another player's id is readable, as it always was", !!aliceId);

const attacker = server.player("Attacker");
await attacker.connected();
let attackerGotView = false;
attacker.on(() => (attackerGotView = true));

const noToken = await rejoinAs(attacker, { gameId, playerId: aliceId });
check("a rejoin with no token is refused", noToken?.success !== true);

const wrongToken = await rejoinAs(attacker, {
  gameId,
  playerId: aliceId,
  token: "not-the-right-token-000000000000",
});
check("a rejoin with a wrong token is refused", wrongToken?.success !== true);

const borrowed = await rejoinAs(attacker, {
  gameId,
  playerId: aliceId,
  token: bob.reconnectToken, // Bob's own token, someone else's seat
});
check(
  "a rejoin with another seat's token is refused",
  borrowed?.success !== true,
);

const beforeProbe = aliceStates;
bob.act("DECLARE_LOBBY_READY");
await sleep(400);
check(
  "the targeted player still receives their own broadcasts",
  aliceStates - beforeProbe > 0,
  `gained ${aliceStates - beforeProbe}`,
);
check("the attacker never received a view", !attackerGotView);

console.log("\nOrdinary reconnection still works:");
// Alice drops and comes back on a fresh socket, the way a phone does.
alice.disconnect();
await sleep(300);
const aliceAgain = server.player("Alice");
await aliceAgain.connected();
let aliceAgainStates = 0;
aliceAgain.on(() => aliceAgainStates++);
const legit = await rejoinAs(aliceAgain, {
  gameId,
  playerId: alice.id,
  token: alice.reconnectToken,
});
check(
  "a rejoin with the right token is accepted",
  legit?.success === true,
  legit?.success ? "" : `refused: ${legit?.message}`,
);
check(
  "it returns that player's own view",
  legit?.gameState?.viewingPlayerId === alice.id,
);

const beforeResume = aliceAgainStates;
bob.act("DECLARE_LOBBY_UNREADY");
await sleep(400);
check(
  "broadcasts resume to the reconnected player",
  aliceAgainStates - beforeResume > 0,
  `gained ${aliceAgainStates - beforeResume}`,
);

// The same token stays valid for a second reconnect: phones drop repeatedly.
aliceAgain.disconnect();
await sleep(250);
const aliceThird = server.player("Alice");
await aliceThird.connected();
const legitTwice = await rejoinAs(aliceThird, {
  gameId,
  playerId: alice.id,
  token: alice.reconnectToken,
});
check(
  "the token still works on a later reconnect",
  legitTwice?.success === true,
);

await server.close();

finish({
  passed: () => "\nA seat can be reclaimed by its owner and by nobody else.",
  failed: (failures) => `
${failures} rejoin ownership failure${failures === 1 ? "" : "s"}.

A rejoin decides who a socket is allowed to be. If the takeover checks fail,
any player at the table can silence another and play as them. If the ordinary
reconnection checks fail, every screen-lock and wifi blip ends the game for
that player instead of recovering it. Treat a failure here as the server being
wrong rather than this script.`,
});
