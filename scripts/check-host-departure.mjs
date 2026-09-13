// Regression coverage for issues #149 and #185. After a game starts nobody is
// removed from `players`, so a departure only flips isConnected. That flag has to
// be recorded in every stage, and the host seat has to follow the players who
// are still there, or a table can be left where nobody is allowed to start.
//
// A host who presses Leave cannot come back, since the client deletes the
// reconnect token, so the seat moves at once. A host whose connection drops
// may be back in seconds, so the seat waits out a grace period first.
//
// Drives the real compiled gameMachine. Run from the repo root, after
// npm run build:server-deps.

import { loadGame, sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const GRACE_MS = 1200;

const { openTable } = await loadGame({
  PEEK_DURATION_MS: 20,
  MATCHING_STAGE_DURATION_MS: 20,
  TURN_TIMER_MS: 45_000,
  LOBBY_DISCONNECT_TIMEOUT_MS: 60_000,
  HOST_DISCONNECT_GRACE_MS: GRACE_MS,
  SCORING_DURATION_MS: 300,
});

const PAST_GRACE_MS = GRACE_MS + 600;
const [HOST, B, C] = ["host", "player-b", "player-c"];

const playToResults = async (t, onScoring) => {
  t.callCheck();
  await t.playUntil("GAMEOVER", { onScoring });
};

const scenarios = {
  async scoringDepartures(t, check) {
    await t.startRound(HOST);
    await playToResults(t, () => {
      t.send({ type: "LEAVE_GAME", playerId: B });
      t.send({ type: "PLAYER_DISCONNECTED", playerId: C });
    });
    check(
      "a player who presses Leave during scoring is away on the results screen",
      t.context().players[B].isConnected === false,
    );
    check(
      "a player who drops during scoring is away on the results screen",
      t.context().players[C].isConnected === false,
    );
  },

  async hostLeavesResults(t, check) {
    await t.startRound(HOST);
    await playToResults(t);
    t.send({ type: "LEAVE_GAME", playerId: HOST });
    const successor = t.context().gameMasterId;
    check(
      "a host who leaves the results screen hands the seat on at once",
      successor !== HOST && t.context().players[successor]?.isConnected,
      `gameMasterId=${successor}`,
    );
    t.send({ type: "PLAY_AGAIN", playerId: successor });
    await sleep(100);
    check(
      "the new host can start the next round",
      successor !== HOST && t.context().gameStage !== "GAMEOVER",
      `stage=${t.context().gameStage}`,
    );
  },

  async hostBlip(t, check) {
    await t.startRound(HOST);
    await playToResults(t);
    t.send({ type: "PLAYER_DISCONNECTED", playerId: HOST });
    check(
      "a host whose connection drops keeps the seat during the grace",
      t.context().gameMasterId === HOST,
    );
    await sleep(300);
    t.send({
      type: "PLAYER_RECONNECTED",
      playerId: HOST,
      newSocketId: "s-host-back",
    });
    await sleep(PAST_GRACE_MS);
    check(
      "a host back within the grace is still host once it has passed",
      t.context().gameMasterId === HOST,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async hostStaysAway(t, check) {
    await t.startRound(HOST);
    await playToResults(t);
    t.send({ type: "PLAYER_DISCONNECTED", playerId: HOST });
    await sleep(PAST_GRACE_MS);
    const successor = t.context().gameMasterId;
    check(
      "a host still away after the grace hands the seat on",
      successor !== HOST && t.context().players[successor]?.isConnected,
      `gameMasterId=${successor}`,
    );
    t.send({
      type: "PLAYER_RECONNECTED",
      playerId: HOST,
      newSocketId: "s-host-late",
    });
    check(
      "a host who returns after the handoff comes back as an ordinary player",
      successor !== HOST && t.context().gameMasterId === successor,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async hostDropsDuringScoring(t, check) {
    await t.startRound(HOST);
    let droppedAt = 0;
    await playToResults(t, () => {
      droppedAt = Date.now();
      t.send({ type: "PLAYER_DISCONNECTED", playerId: HOST });
    });
    await sleep(Math.max(0, droppedAt + PAST_GRACE_MS - Date.now()));
    check(
      "a host who drops during scoring hands the seat on after the grace",
      t.context().gameMasterId !== HOST,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async hostLeavesMidRound(t, check) {
    await t.startRound(HOST);
    t.send({ type: "LEAVE_GAME", playerId: HOST });
    check(
      "a host who leaves mid-round hands the seat on at once",
      t.context().gameMasterId !== HOST,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async everyoneAwayThenBack(t, check) {
    await t.startRound(HOST);
    await playToResults(t);
    t.send({ type: "PLAYER_DISCONNECTED", playerId: B });
    t.send({ type: "PLAYER_DISCONNECTED", playerId: C });
    t.send({ type: "PLAYER_DISCONNECTED", playerId: HOST });
    await sleep(PAST_GRACE_MS);
    check(
      "a host keeps the seat while nobody else is there to take it",
      t.context().gameMasterId === HOST,
    );
    t.send({ type: "PLAYER_RECONNECTED", playerId: B, newSocketId: "s-b" });
    t.send({ type: "PLAYER_RECONNECTED", playerId: C, newSocketId: "s-c" });
    check(
      "once the grace is over the seat goes to the first player back",
      t.context().gameMasterId === B,
      `gameMasterId=${t.context().gameMasterId}`,
    );
    t.send({ type: "PLAY_AGAIN", playerId: B });
    await sleep(100);
    check(
      "and that player can start the next round",
      t.context().gameStage !== "GAMEOVER",
      `stage=${t.context().gameStage}`,
    );
  },

  async hostLeavesAnEmptyTable(t, check) {
    await t.startRound(HOST);
    await playToResults(t);
    t.send({ type: "PLAYER_DISCONNECTED", playerId: B });
    t.send({ type: "PLAYER_DISCONNECTED", playerId: C });
    t.send({ type: "LEAVE_GAME", playerId: HOST });
    t.send({ type: "PLAYER_RECONNECTED", playerId: C, newSocketId: "s-c" });
    check(
      "a host who left is replaced by the first player back, with no wait",
      t.context().gameMasterId === C,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async lobbyUnchanged(t, check) {
    t.send({ type: "PLAYER_DISCONNECTED", playerId: HOST });
    await sleep(PAST_GRACE_MS);
    check(
      "in the lobby a dropped host is left to the lobby's own timeout",
      t.context().gameMasterId === HOST &&
        t.context().gameStage === "WAITING_FOR_PLAYERS",
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },
};

const report = createReport();

// The scenarios run at once, so each reports into its own buffer.
const scenarioReports = await Promise.all(
  Object.entries(scenarios).map(async ([label, run]) => {
    const scenarioReport = createReport({ buffered: true });
    const table = openTable({
      gameId: `CHECK-HOST-${label}`,
      seed: 149,
      players: [HOST, B, C],
      label,
    });
    table.readyLobby();
    try {
      await run(table, scenarioReport.check);
    } catch (error) {
      scenarioReport.check(`${label} ran to the end`, false, error.message);
    }
    scenarioReport.check(
      `${label}: the actor never errored`,
      table.errors.length === 0,
    );
    table.stop();
    return scenarioReport;
  }),
);
for (const scenarioReport of scenarioReports) report.absorb(scenarioReport);

report.finish({
  passed: (checks) =>
    `Host and scoring departures are handled (${checks} checks).`,
  failed: (failures) =>
    `\n${failures} host departure check${failures === 1 ? "" : "s"} failed.`,
});
