// Guards the trust boundary between a socket message and the state machine.
//
// Guards inside the machine destructure event payloads directly, for example
// canAttemptMatch reads `payload: { handCardIndex }`. An action that arrives
// without a payload therefore throws mid-transition, and XState turns a throw
// in a guard into an actor error, which stops the machine. One malformed
// message from any player used to end the game for everyone: no timer fires,
// no turn advances, and no broadcast is ever emitted again.
//
// The trap is that the damage is silent and total. A stopped actor still
// answers getSnapshot, so the game keeps looking alive from the outside and
// rejoins keep succeeding, while nothing can ever move.
//
// Liveness here is deliberately not "did a packet arrive": a refused action is
// answered, so packets arrive either way. It is "did the game leave the
// matching stage on its own timer", which only a running machine can do.
//
// Drives the real compiled server over real sockets.
//
// Run from the repo root, after npm run build:server-deps.

import { sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";

const MATCHING_STAGE_DURATION_MS = 1500;

const server = await startServer({
  PEEK_DURATION_MS: 150,
  MATCHING_STAGE_DURATION_MS,
  TURN_TIMER_MS: 60_000,
});
const { check, finish } = createReport();

const A = server.player("A");
const B = server.player("B");
const last = () => A.state;

const gameId = await A.createGame({ seats: 2 });
await B.joinGame(gameId);
A.act("DECLARE_LOBBY_READY");
B.act("DECLARE_LOBBY_READY");
await sleep(250);
A.act("START_GAME");
await sleep(400);
A.act("DECLARE_READY_FOR_PEEK");
B.act("DECLARE_READY_FOR_PEEK");

// Reach a matching window, which is where the reachable crash lives.
for (let i = 0; i < 80; i++) {
  await sleep(150);
  if (!last()) continue;
  if (last().turnPhase === "MATCHING") break;
  const player = last().currentPlayerId === A.id ? A : B;
  if (last().turnPhase === "DRAW") player.act("DRAW_FROM_DECK");
  else if (last().turnPhase === "DISCARD") player.act("DISCARD_DRAWN_CARD");
}

console.log("\nA malformed action must not take the game with it:");
check(
  "a matching window was reached",
  last()?.turnPhase === "MATCHING",
  `phase is ${last()?.turnPhase}`,
);

// Every shape that used to throw inside a guard.
for (const payload of [undefined, null, "nonsense", 7]) {
  B.act("ATTEMPT_MATCH", payload);
  A.act("USE_ABILITY", payload);
  A.act("SWAP_AND_DISCARD", payload);
  A.act("REMOVE_PLAYER", payload);
}
await sleep(150);

// Only a running machine leaves the matching stage on its own timer. A stopped
// one never broadcasts again, so the wait runs out.
const phaseBefore = last()?.turnPhase;
const leftMatching = await A.waitFor(
  (state) => state.turnPhase !== "MATCHING",
  "the matching window to close",
  MATCHING_STAGE_DURATION_MS + 2500,
).then(
  () => true,
  () => false,
);
check(
  "the game kept running afterwards",
  leftMatching && last()?.turnPhase !== "MATCHING",
  `${phaseBefore} -> ${last()?.turnPhase}`,
);

// And it is still a real game, not a corpse that merely answers. A completed
// turn is the signal: the discard pile only grows when play actually happens.
// Comparing whole states would not do, because serverNow changes every
// broadcast and would pass on any packet at all.
const pileAtStart = last()?.discardPileSize ?? 0;
for (let i = 0; i < 120; i++) {
  await sleep(150);
  if (!last()) continue;
  if ((last().discardPileSize ?? 0) > pileAtStart) break;
  const player = last().currentPlayerId === A.id ? A : B;
  if (last().turnPhase === "DRAW") player.act("DRAW_FROM_DECK");
  else if (last().turnPhase === "DISCARD") player.act("DISCARD_DRAWN_CARD");
  else if (last().turnPhase === "MATCHING") {
    A.act("PASS_ON_MATCH_ATTEMPT");
    B.act("PASS_ON_MATCH_ATTEMPT");
  } else if (last().turnPhase === "ABILITY") {
    const owner = last().abilityStack?.at(-1)?.playerId;
    (owner === A.id ? A : B).act("USE_ABILITY", { action: "skip" });
  }
}
check(
  "play can continue",
  (last()?.discardPileSize ?? 0) > pileAtStart,
  `discard pile ${pileAtStart} -> ${last()?.discardPileSize}`,
);

await server.close();

finish({
  passed: () => "\nA malformed message is rejected, not fatal.",
  failed: (failures) => `
${failures} malformed-payload failure${failures === 1 ? "" : "s"}.

A message from one player must never be able to stop the machine. If it can,
the game dies for everyone at once, with no timer left to recover it and
nothing on any screen to explain it. Treat a failure here as the server being
wrong rather than this script.`,
});
