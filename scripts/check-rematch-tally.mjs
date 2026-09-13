// Regression coverage for issue #144. After a game starts nobody is removed from
// `players`, so a vote filtered on membership still counts a player who has gone.
// The tally has to follow presence, while the vote itself is kept so a player
// whose connection drops and comes back does not have to vote again.
//
// Drives the real compiled gameMachine and reads the real redacted views. Run
// from the repo root, after npm run build:server-deps.

import { loadGame } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const { openTable, generatePlayerView } = await loadGame({
  PEEK_DURATION_MS: 20,
  MATCHING_STAGE_DURATION_MS: 20,
  TURN_TIMER_MS: 45_000,
  SCORING_DURATION_MS: 300,
});

const [HOST, B, C] = ["host", "player-b", "player-c"];
const { check, finish } = createReport();

const table = openTable({
  gameId: "CHECK-REMATCH-TALLY",
  seed: 144,
  players: [HOST, B, C],
});
const send = table.send;
const votesSeenBy = (playerId) =>
  generatePlayerView(table.snapshot(), playerId).rematchVotes;

table.readyLobby();
await table.startRound(HOST);
table.callCheck();
await table.playUntil("GAMEOVER");

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

table.stop();
check("the actor never entered an error state", table.errors.length === 0);

finish({
  passed: (checks) =>
    `The rematch tally counts only players who are there (${checks} checks).`,
  failed: (failures) =>
    `\n${failures} rematch tally check${failures === 1 ? "" : "s"} failed.`,
});
