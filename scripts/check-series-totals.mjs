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

import { loadGame } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const { openTable } = await loadGame({
  PEEK_DURATION_MS: 80,
  MATCHING_STAGE_DURATION_MS: 120,
  TURN_TIMER_MS: 220,
  SCORING_DURATION_MS: 300,
});

const P1 = "player-1";
const P2 = "player-2";

const { check, finish } = createReport();
const table = openTable({
  gameId: "CHECK-TOTALS",
  seed: 109,
  players: [P1, P2],
});
const { send, waitFor } = table;
const ctx = table.context;

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

table.readyLobby();
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

// Play Again resets the round and not the series. SCORING holds before
// GAMEOVER, and PLAY_AGAIN before that is ignored rather than refused, so
// waiting for GAMEOVER is not optional here.
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

table.readyLobby();
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

table.stop();

finish({
  passed: (checks) => `Series totals accumulate correctly (${checks} checks).`,
  failed: (failures) => `
${failures} series total check${failures === 1 ? "" : "s"} failed.

playerTotals is accumulated in server/src/game-machine.ts and read by the
standing in the round summary. A total that is wrong is not visible in a single
round, only across a series, which is why this runs rather than being played.`,
});
