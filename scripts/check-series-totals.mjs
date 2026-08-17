// Guards the running series total each player's standing is ordered by: a total
// is the sum of the rounds actually played, it survives Play Again while the
// round scores do not, and every player carries one rather than only winners.
//
// The last of those is the one worth a check. The standing sorts on wins and
// breaks ties on the lower total, so a total that counted only winners would
// rank everyone who has never won as equal to everyone else who never has.
//
// Drives the real compiled gameMachine. Turns are not played by hand: the peek,
// matching and turn windows are shortened from the environment so the machine
// walks its own turns, which is enough to reach SCORING with real hands and real
// scores. server/.env.example documents every duration this reads.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "80";
process.env.MATCHING_STAGE_DURATION_MS = "120";
process.env.TURN_TIMER_MS = "220";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const P1 = "player-1";
const P2 = "player-2";

const actor = createActor(gameMachine, { input: { gameId: "CHECK-TOTALS" } });
actor.subscribe({ error: (err) => console.log("actor error:", err) });
actor.start();

const ctx = () => actor.getSnapshot().context;
const send = (e) => actor.send(e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitFor = async (predicate, what, ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (predicate(ctx())) return true;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${what} (stage=${ctx().gameStage})`);
};

let failures = 0;
let ran = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`);
  ran++;
  if (!ok) failures++;
};

const playRound = async (n) => {
  await waitFor((c) => c.gameStage === "PLAYING", `round ${n} to start`);
  // One Check ends the round. The turn timer walks the final turns by itself.
  send({ type: "CALL_CHECK", playerId: ctx().currentPlayerId ?? P1 });
  await waitFor(
    (c) => c.gameStage === "SCORING" || c.gameStage === "GAMEOVER",
    `round ${n} to score`,
  );
  return Object.fromEntries(
    Object.values(ctx().players).map((p) => [p.id, p.score]),
  );
};

send({
  type: "PLAYER_JOIN_REQUEST",
  playerSetupData: { name: "P1", socketId: "s1" },
  playerId: P1,
});
send({
  type: "PLAYER_JOIN_REQUEST",
  playerSetupData: { name: "P2", socketId: "s2" },
  playerId: P2,
});
send({ type: "DECLARE_LOBBY_READY", playerId: P1 });
send({ type: "DECLARE_LOBBY_READY", playerId: P2 });
send({ type: "START_GAME", playerId: P1 });

const round1 = await playRound(1);
const totals1 = { ...ctx().playerTotals };

check(
  "totals exist once a round has been scored",
  totals1 && Object.keys(totals1).length > 0,
  JSON.stringify(totals1),
);
for (const id of [P1, P2]) {
  check(
    `${id} total equals its first round score`,
    totals1[id] === round1[id],
    `total=${totals1[id]} score=${round1[id]}`,
  );
}

// Play Again resets the round and not the series. SCORING holds for a few
// seconds so the sheet can be read, and PLAY_AGAIN before that is ignored
// rather than refused, so waiting for GAMEOVER is not optional here.
await waitFor((c) => c.gameStage === "GAMEOVER", "the end screen to settle");
const epochBefore = ctx().roundEpoch;
const host = ctx().gameMasterId ?? P1;
send({ type: "PLAY_AGAIN", playerId: host });
await waitFor((c) => c.roundEpoch > epochBefore, "the round to reset");

check(
  "totals survive Play Again",
  [P1, P2].every((id) => ctx().playerTotals[id] === round1[id]),
  JSON.stringify(ctx().playerTotals),
);
check(
  "round scores are cleared by Play Again",
  Object.values(ctx().players).every((p) => p.score === 0),
);

send({ type: "DECLARE_LOBBY_READY", playerId: P1 });
send({ type: "DECLARE_LOBBY_READY", playerId: P2 });
send({ type: "START_GAME", playerId: host });

const round2 = await playRound(2);
const totals2 = { ...ctx().playerTotals };

for (const id of [P1, P2]) {
  check(
    `${id} total is the sum of both rounds`,
    totals2[id] === round1[id] + round2[id],
    `total=${totals2[id]} expected=${round1[id] + round2[id]}`,
  );
}
check(
  "every player is credited, not only winners",
  [P1, P2].every((id) => typeof totals2[id] === "number"),
  JSON.stringify(totals2),
);

actor.stop();

if (failures > 0) {
  console.error(`
${failures} series total check${failures === 1 ? "" : "s"} failed.

playerTotals is accumulated in server/src/game-machine.ts and read by the
standing in the round summary. A total that is wrong is not visible in a single
round, only across a series, which is why this runs rather than being played.`);
  process.exit(1);
}

console.log(`Series totals accumulate correctly (${ran} checks).`);
