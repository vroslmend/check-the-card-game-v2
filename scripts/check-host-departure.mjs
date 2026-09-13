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

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "20";
process.env.MATCHING_STAGE_DURATION_MS = "20";
process.env.TURN_TIMER_MS = "45000";
process.env.LOBBY_DISCONNECT_TIMEOUT_MS = "60000";
process.env.HOST_DISCONNECT_GRACE_MS = "1200";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const GRACE_MS = 1200;
const PAST_GRACE_MS = GRACE_MS + 600;
const [HOST, B, C] = ["host", "player-b", "player-c"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const newTable = (label) => {
  const actor = createActor(gameMachine, {
    input: { gameId: `CHECK-HOST-${label}`, seed: 149 },
  });
  const errors = [];
  actor.subscribe({ error: (error) => errors.push(error) });
  actor.start();
  const context = () => actor.getSnapshot().context;
  const send = (event) => actor.send(event);
  const waitFor = async (predicate, what, timeoutMs = 20_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate(context())) return;
      await sleep(10);
    }
    throw new Error(
      `${label}: timed out waiting for ${what} (stage=${context().gameStage})`,
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

  const startRound = async () => {
    send({ type: "START_GAME", playerId: HOST });
    await waitFor((c) => c.gameStage === "INITIAL_PEEK", "initial peek");
    [HOST, B, C].forEach((playerId) =>
      send({ type: "DECLARE_READY_FOR_PEEK", playerId }),
    );
    await waitFor(
      (c) => c.gameStage === "PLAYING" && c.currentTurnSegment === "DRAW",
      "playing",
    );
  };

  // onScoring runs once, as soon as SCORING is entered.
  const playToGameover = async (onScoring = () => {}) => {
    send({ type: "CALL_CHECK", playerId: context().currentPlayerId });
    let scoringSeen = false;
    const deadline = Date.now() + 30_000;
    while (context().gameStage !== "GAMEOVER" && Date.now() < deadline) {
      const c = context();
      if (c.gameStage === "SCORING" && !scoringSeen) {
        scoringSeen = true;
        onScoring();
      } else if (c.currentTurnSegment === "DRAW" && c.currentPlayerId) {
        send({ type: "DRAW_FROM_DECK", playerId: c.currentPlayerId });
      } else if (c.currentTurnSegment === "DISCARD" && c.currentPlayerId) {
        send({ type: "DISCARD_DRAWN_CARD", playerId: c.currentPlayerId });
      } else if (c.currentTurnSegment === "MATCHING") {
        for (const playerId of c.matchingOpportunity?.remainingPlayerIDs ??
          []) {
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
  };

  return { actor, context, send, waitFor, startRound, playToGameover, errors };
};

const scenarios = {
  async scoringDepartures(t, check) {
    await t.startRound();
    await t.playToGameover(() => {
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
    await t.startRound();
    await t.playToGameover();
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
    await t.startRound();
    await t.playToGameover();
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
    await t.startRound();
    await t.playToGameover();
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
    await t.startRound();
    let droppedAt = 0;
    await t.playToGameover(() => {
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
    await t.startRound();
    t.send({ type: "LEAVE_GAME", playerId: HOST });
    check(
      "a host who leaves mid-round hands the seat on at once",
      t.context().gameMasterId !== HOST,
      `gameMasterId=${t.context().gameMasterId}`,
    );
  },

  async everyoneAwayThenBack(t, check) {
    await t.startRound();
    await t.playToGameover();
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
    await t.startRound();
    await t.playToGameover();
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

const results = await Promise.all(
  Object.entries(scenarios).map(async ([label, run]) => {
    const lines = [];
    let failed = 0;
    const check = (name, passed, detail = "") => {
      lines.push(
        `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
      );
      if (!passed) failed++;
    };
    const table = newTable(label);
    try {
      await run(table, check);
    } catch (error) {
      check(`${label} ran to the end`, false, error.message);
    }
    check(`${label}: the actor never errored`, table.errors.length === 0);
    table.actor.stop();
    return { lines, failed };
  }),
);

let failures = 0;
let checks = 0;
for (const { lines, failed } of results) {
  for (const line of lines) console.log(line);
  failures += failed;
  checks += lines.length;
}

if (failures > 0) {
  console.error(
    `\n${failures} host departure check${failures === 1 ? "" : "s"} failed.`,
  );
  process.exit(1);
}
console.log(`Host and scoring departures are handled (${checks} checks).`);
