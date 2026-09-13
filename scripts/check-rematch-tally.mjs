// Regression coverage for issue #144. After a game starts nobody is removed from
// `players`, so a vote filtered on membership still counts a player who has gone.
// The tally has to follow presence, while the vote itself is kept so a player
// whose connection drops and comes back does not have to vote again.
//
// Drives the real compiled gameMachine and reads the real redacted views. Run
// from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "20";
process.env.MATCHING_STAGE_DURATION_MS = "20";
process.env.TURN_TIMER_MS = "45000";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { generatePlayerView } = await import("../server/dist/state-redactor.js");
const { createActor } = await import("xstate");

const [HOST, B, C] = ["host", "player-b", "player-c"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
let checks = 0;
const check = (name, passed, detail = "") => {
  checks++;
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const actor = createActor(gameMachine, {
  input: { gameId: "CHECK-REMATCH-TALLY", seed: 144 },
});
const errors = [];
actor.subscribe({ error: (error) => errors.push(error) });
actor.start();
const context = () => actor.getSnapshot().context;
const send = (event) => actor.send(event);
const votesSeenBy = (playerId) =>
  generatePlayerView(actor.getSnapshot(), playerId).rematchVotes;
const waitFor = async (predicate, what, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate(context())) return;
    await sleep(10);
  }
  throw new Error(
    `Timed out waiting for ${what} (stage=${context().gameStage})`,
  );
};

[HOST, B, C].forEach((playerId, index) =>
  send({
    type: "PLAYER_JOIN_REQUEST",
    playerSetupData: { name: `P${index + 1}`, socketId: `s-${playerId}` },
    playerId,
  }),
);
[HOST, B, C].forEach((playerId) =>
  send({ type: "DECLARE_LOBBY_READY", playerId }),
);
send({ type: "START_GAME", playerId: HOST });
await waitFor((c) => c.gameStage === "INITIAL_PEEK", "initial peek");
[HOST, B, C].forEach((playerId) =>
  send({ type: "DECLARE_READY_FOR_PEEK", playerId }),
);
await waitFor(
  (c) => c.gameStage === "PLAYING" && c.currentTurnSegment === "DRAW",
  "playing",
);
send({ type: "CALL_CHECK", playerId: context().currentPlayerId });

const deadline = Date.now() + 30_000;
while (context().gameStage !== "GAMEOVER" && Date.now() < deadline) {
  const c = context();
  if (c.currentTurnSegment === "DRAW" && c.currentPlayerId) {
    send({ type: "DRAW_FROM_DECK", playerId: c.currentPlayerId });
  } else if (c.currentTurnSegment === "DISCARD" && c.currentPlayerId) {
    send({ type: "DISCARD_DRAWN_CARD", playerId: c.currentPlayerId });
  } else if (c.currentTurnSegment === "MATCHING") {
    for (const playerId of c.matchingOpportunity?.remainingPlayerIDs ?? []) {
      send({ type: "PASS_ON_MATCH_ATTEMPT", playerId });
    }
  } else if (c.currentTurnSegment === "ABILITY") {
    const ability = c.abilityStack.at(-1);
    if (ability) {
      send({
        type: "USE_ABILITY",
        playerId: ability.playerId,
        payload: { action: "skip" },
      });
    }
  }
  await sleep(10);
}
await waitFor((c) => c.gameStage === "GAMEOVER", "game over");

send({ type: "REQUEST_PLAY_AGAIN", playerId: B });
send({ type: "REQUEST_PLAY_AGAIN", playerId: C });
check(
  "both votes reach the host while both voters are there",
  votesSeenBy(HOST).includes(B) && votesSeenBy(HOST).includes(C),
  JSON.stringify(votesSeenBy(HOST)),
);

send({ type: "PLAYER_DISCONNECTED", playerId: C });
const droppedVoterExcluded = !votesSeenBy(HOST).includes(C);
check(
  "a voter whose connection drops is not counted while they are away",
  droppedVoterExcluded,
  JSON.stringify(votesSeenBy(HOST)),
);

send({ type: "PLAYER_RECONNECTED", playerId: C, newSocketId: "s-c-back" });
check(
  "their vote counts again when they come back, without voting again",
  droppedVoterExcluded && votesSeenBy(HOST).includes(C),
  JSON.stringify(votesSeenBy(HOST)),
);

send({ type: "LEAVE_GAME", playerId: B });
check(
  "a voter who presses Leave is not counted",
  !votesSeenBy(HOST).includes(B),
  JSON.stringify(votesSeenBy(HOST)),
);
check(
  "every player at the table sees the same tally",
  JSON.stringify(votesSeenBy(C)) === JSON.stringify(votesSeenBy(HOST)),
  `host=${JSON.stringify(votesSeenBy(HOST))} c=${JSON.stringify(votesSeenBy(C))}`,
);

actor.stop();
check("the actor never entered an error state", errors.length === 0);

if (failures > 0) {
  console.error(
    `\n${failures} rematch tally check${failures === 1 ? "" : "s"} failed.`,
  );
  process.exit(1);
}
console.log(
  `The rematch tally counts only players who are there (${checks} checks).`,
);
