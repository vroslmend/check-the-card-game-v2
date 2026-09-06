// Regression coverage for issue #148. A disconnected current player must not
// send the table into a recovery pause or auto-play a phantom hand. They get
// one ordinary turn window, then forfeit only this round: their frozen hand is
// revealed and scored, but they cannot win or accrue series totals. The next
// round rebuilds the active turn order from connected seats.
//
// Drives the real compiled gameMachine. Run from the repo root, after
// npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "20";
process.env.MATCHING_STAGE_DURATION_MS = "20";
// The machine clamps timer delays to at least 1s so a short test still uses
// the same timer path as production. This is intentionally short enough to
// make the old 120s recovery pause observable as a timeout.
process.env.TURN_TIMER_MS = "1100";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const PLAYERS = ["player-1", "player-2", "player-3"];
const SCORE_BY_RANK = {
  A: -1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
};

const actor = createActor(gameMachine, {
  input: { gameId: "CHECK-DISCONNECT-FORFEIT", seed: 148 },
});
const errors = [];
actor.subscribe({ error: (error) => errors.push(error) });
actor.start();

const snapshot = () => actor.getSnapshot();
const context = () => snapshot().context;
const send = (event) => actor.send(event);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, what, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate(context())) return;
    await sleep(10);
  }
  throw new Error(
    `Timed out waiting for ${what} (stage=${context().gameStage}, current=${context().currentPlayerId})`,
  );
};

const waitForActor = async (
  targetActor,
  predicate,
  what,
  timeoutMs = 5_000,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targetContext = targetActor.getSnapshot().context;
    if (predicate(targetContext)) return;
    await sleep(10);
  }
  const targetContext = targetActor.getSnapshot().context;
  throw new Error(
    `Timed out waiting for ${what} (stage=${targetContext.gameStage}, current=${targetContext.currentPlayerId})`,
  );
};

let checks = 0;
let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  checks++;
  if (!passed) failures++;
};

const driveFinalTurnsToScoring = async () => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const c = context();
    if (c.gameStage === "SCORING" || c.gameStage === "GAMEOVER") return;

    if (c.gameStage === "FINAL_TURNS") {
      if (c.currentTurnSegment === "DRAW" && c.currentPlayerId) {
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
    }
    await sleep(10);
  }
  throw new Error(
    `Timed out driving final turns (stage=${context().gameStage})`,
  );
};

const driveConnectedTurn = () => {
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
};

for (const [index, playerId] of PLAYERS.entries()) {
  send({
    type: "PLAYER_JOIN_REQUEST",
    playerSetupData: { name: `P${index + 1}`, socketId: `socket-${index + 1}` },
    playerId,
  });
}
for (const playerId of PLAYERS) {
  send({ type: "DECLARE_LOBBY_READY", playerId });
}
send({ type: "START_GAME", playerId: PLAYERS[0] });

await waitFor((c) => c.gameStage === "INITIAL_PEEK", "initial peek");
for (const playerId of PLAYERS) {
  send({ type: "DECLARE_READY_FOR_PEEK", playerId });
}
await waitFor((c) => c.gameStage === "PLAYING", "playing round one");

const disconnectedId = context().currentPlayerId;
const handBeforeForfeit = context().players[disconnectedId].hand.map(
  (card) => card?.id ?? null,
);
const deadlineBeforeDisconnect = context().turnDeadline;
const disconnectAt = Date.now();
send({ type: "PLAYER_DISCONNECTED", playerId: disconnectedId });

check(
  "disconnecting the current player does not enter a recovery state",
  snapshot().status === "active" &&
    snapshot().value !== "error" &&
    context().gameStage === "PLAYING" &&
    context().currentPlayerId === disconnectedId,
  `state=${JSON.stringify(snapshot().value)}`,
);
check(
  "the ordinary turn deadline remains armed",
  context().turnDeadline === deadlineBeforeDisconnect &&
    context().turnDeadline > Date.now(),
  `deadline=${context().turnDeadline}`,
);

await waitFor(
  (c) => c.players[disconnectedId]?.forfeited === true,
  "disconnected player to forfeit after one turn window",
  5_000,
);
const elapsed = Date.now() - disconnectAt;
const forfeited = context().players[disconnectedId];
check(
  "the disconnected player forfeits after one ordinary window",
  elapsed >= 900 && elapsed < 4_000,
  `elapsed=${elapsed}ms`,
);
check(
  "the frozen hand is preserved and the table advances",
  forfeited.isLocked &&
    !context().turnOrder.includes(disconnectedId) &&
    context().currentPlayerId !== disconnectedId &&
    JSON.stringify(forfeited.hand.map((card) => card?.id ?? null)) ===
      JSON.stringify(handBeforeForfeit),
  `turnOrder=${JSON.stringify(context().turnOrder)}`,
);
check(
  "the round remains live for the connected players",
  context().gameStage === "PLAYING" && context().turnOrder.length === 2,
  `stage=${context().gameStage}`,
);

// Reconnecting after the deadline restores connectivity but not this round's
// forfeiture. The reset, not a client action, is what makes the seat active.
send({
  type: "PLAYER_RECONNECTED",
  playerId: disconnectedId,
  newSocketId: "socket-reconnected",
});
check(
  "a late reconnect cannot re-enter the current round",
  context().players[disconnectedId].isConnected &&
    context().players[disconnectedId].forfeited &&
    !context().turnOrder.includes(disconnectedId),
);

send({ type: "CALL_CHECK", playerId: context().currentPlayerId });
await driveFinalTurnsToScoring();
await waitFor(
  (c) => c.gameStage === "SCORING" || c.gameStage === "GAMEOVER",
  "round one scoring",
);

const forfeitedScore = forfeited.hand.reduce(
  (sum, card) => sum + (card ? SCORE_BY_RANK[card.rank] : 0),
  0,
);
const scoredForfeited = context().players[disconnectedId];
check(
  "the forfeited hand is still scored and revealed",
  scoredForfeited.score === forfeitedScore &&
    context().gameover?.playerScores[disconnectedId] === forfeitedScore,
  `score=${scoredForfeited.score} expected=${forfeitedScore}`,
);
check(
  "the forfeited player cannot win or accrue series totals",
  !context().gameover?.winnerIds.includes(disconnectedId) &&
    !Object.prototype.hasOwnProperty.call(
      context().playerWins,
      disconnectedId,
    ) &&
    !Object.prototype.hasOwnProperty.call(
      context().playerTotals,
      disconnectedId,
    ),
  `winners=${JSON.stringify(context().gameover?.winnerIds)}`,
);

await waitFor((c) => c.gameStage === "GAMEOVER", "game over");
const host = context().gameMasterId;
send({ type: "PLAYER_DISCONNECTED", playerId: disconnectedId });
send({ type: "PLAYER_DISCONNECTED", playerId: PLAYERS[2] });
const epochBeforeBlockedRematch = context().roundEpoch;
send({ type: "PLAY_AGAIN", playerId: host });
await sleep(50);
check(
  "a host alone cannot start a one-player rematch",
  context().roundEpoch === epochBeforeBlockedRematch &&
    context().gameStage === "GAMEOVER",
);
send({
  type: "PLAYER_RECONNECTED",
  playerId: disconnectedId,
  newSocketId: "socket-reconnected-again",
});
send({ type: "PLAYER_RECONNECTED", playerId: PLAYERS[2], newSocketId: "s3b" });

send({ type: "PLAY_AGAIN", playerId: host });
await waitFor((c) => c.gameStage === "INITIAL_PEEK", "round two peek");
check(
  "the next round rebuilds turnOrder from connected seats",
  context().turnOrder.length === 3 &&
    PLAYERS.every((playerId) => context().turnOrder.includes(playerId)) &&
    new Set(context().turnOrder).size === 3 &&
    context().players[disconnectedId].forfeited === false,
  `turnOrder=${JSON.stringify(context().turnOrder)}`,
);
for (const playerId of PLAYERS) {
  send({ type: "DECLARE_READY_FOR_PEEK", playerId });
}

await waitFor((c) => c.gameStage === "PLAYING", "playing round two");
const disconnectedBeforeTurn = PLAYERS.find(
  (playerId) => playerId !== context().currentPlayerId,
);
send({ type: "PLAYER_DISCONNECTED", playerId: disconnectedBeforeTurn });
check(
  "a non-current disconnect does not pause the table",
  context().gameStage === "PLAYING" &&
    context().currentPlayerId !== disconnectedBeforeTurn &&
    snapshot().value !== "error",
  `current=${context().currentPlayerId}`,
);

const driveUntilLaterForfeit = async () => {
  const deadline = Date.now() + 8_000;
  while (
    Date.now() < deadline &&
    !context().players[disconnectedBeforeTurn].forfeited
  ) {
    driveConnectedTurn();
    await sleep(10);
  }
};
await driveUntilLaterForfeit();

await waitFor(
  (c) => c.players[disconnectedBeforeTurn].forfeited === true,
  "non-current disconnected player to reach their turn and forfeit",
  8_000,
);
check(
  "a disconnected player is handled normally when their later turn arrives",
  !context().turnOrder.includes(disconnectedBeforeTurn) &&
    context().gameStage === "PLAYING",
  `turnOrder=${JSON.stringify(context().turnOrder)}`,
);

const scenarioPlayer = (id, overrides = {}) => ({
  id,
  name: id,
  socketId: `socket-${id}`,
  hand: [{ id: `${id}-card`, rank: "2", suit: "S" }],
  status: "WAITING",
  isReady: true,
  isDealer: false,
  hasCalledCheck: false,
  isLocked: false,
  score: 0,
  isConnected: true,
  pendingDrawnCard: null,
  forfeited: false,
  ...overrides,
});

const scenarioActor = ({
  players,
  turnOrder,
  gameMasterId,
  currentPlayerId,
}) => {
  const seedActor = createActor(gameMachine, {
    input: { gameId: "CHECK-DISCONNECT-SCENARIO", seed: 148 },
  });
  seedActor.start();
  const initial = seedActor.getSnapshot();
  seedActor.stop();

  const state = gameMachine.resolveState({
    value: { PLAYING: { turn: "DRAW" } },
    context: {
      ...initial.context,
      players,
      turnOrder,
      gameMasterId,
      currentPlayerId,
      currentTurnSegment: "DRAW",
      gameStage: "PLAYING",
      deck: [{ id: "scenario-deck-card", rank: "3", suit: "S" }],
    },
    status: "active",
  });
  const targetActor = createActor(gameMachine, { snapshot: state });
  targetActor.start();
  return targetActor;
};

const tieActor = scenarioActor({
  players: {
    "score-a": scenarioPlayer("score-a"),
    "score-b": scenarioPlayer("score-b", {
      isConnected: false,
      isLocked: true,
      forfeited: true,
    }),
  },
  turnOrder: ["score-a", "score-b"],
  gameMasterId: "score-a",
  currentPlayerId: "score-a",
});
tieActor.send({ type: "CALL_CHECK", playerId: "score-a" });
const tieContext = tieActor.getSnapshot().context;
check(
  "a forfeited player cannot win a tied score",
  !tieContext.gameover?.winnerIds.includes("score-b") &&
    !Object.prototype.hasOwnProperty.call(tieContext.playerWins, "score-b"),
  `winners=${JSON.stringify(tieContext.gameover?.winnerIds)}`,
);
tieActor.stop();

const finalTurnHostActor = scenarioActor({
  players: {
    other: scenarioPlayer("other"),
    host: scenarioPlayer("host"),
  },
  turnOrder: ["other", "host"],
  gameMasterId: "host",
  currentPlayerId: "other",
});
finalTurnHostActor.send({ type: "CALL_CHECK", playerId: "other" });
finalTurnHostActor.send({ type: "PLAYER_DISCONNECTED", playerId: "host" });
await waitForActor(
  finalTurnHostActor,
  (c) => c.players.host.forfeited === true,
  "final-turn host to forfeit",
);
const finalTurnHostContext = finalTurnHostActor.getSnapshot().context;
check(
  "a forfeiting host is reassigned even when the survivor is locked",
  finalTurnHostContext.gameMasterId === "other" &&
    finalTurnHostContext.gameStage === "SCORING",
  `gameMasterId=${finalTurnHostContext.gameMasterId} stage=${finalTurnHostContext.gameStage}`,
);
finalTurnHostActor.stop();

actor.stop();

check("the actor never entered an error state", errors.length === 0);
if (failures > 0) {
  console.error(
    `\n${failures} disconnect/forfeit check${failures === 1 ? "" : "s"} failed.`,
  );
  process.exit(1);
}

console.log(`Disconnect/forfeit lifecycle is correct (${checks} checks).`);
