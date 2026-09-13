// Regression coverage for issue #148. A disconnected current player must not
// send the table into a recovery pause or auto-play a phantom hand. They get
// one ordinary turn window, then forfeit only this round: their frozen hand is
// revealed and scored, but they cannot win or accrue series totals. The next
// round rebuilds the active turn order from connected seats.
//
// Drives the real compiled gameMachine. Run from the repo root, after
// npm run build:server-deps.

import { loadGame, sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const { openTable, tableFor, gameMachine, createActor } = await loadGame({
  PEEK_DURATION_MS: 20,
  MATCHING_STAGE_DURATION_MS: 20,
  // The machine clamps timer delays to at least 1s so a short test still uses
  // the same timer path as production. This is intentionally short enough to
  // make the old 120s recovery pause observable as a timeout.
  TURN_TIMER_MS: 1100,
  SCORING_DURATION_MS: 300,
});

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

const { check, finish } = createReport();
const table = openTable({
  gameId: "CHECK-DISCONNECT-FORFEIT",
  seed: 148,
  players: PLAYERS,
});
const { snapshot, context, send, waitFor } = table;

table.readyLobby();
await table.startRound(PLAYERS[0]);

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

table.callCheck();
await table.playUntil("SCORING");

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
const inactiveNextRoundId = PLAYERS[2];
const inactiveTotalBeforeRematch = context().playerTotals[inactiveNextRoundId];
send({ type: "PLAYER_DISCONNECTED", playerId: disconnectedId });
send({ type: "PLAYER_DISCONNECTED", playerId: inactiveNextRoundId });
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

send({ type: "PLAY_AGAIN", playerId: host });
await waitFor((c) => c.gameStage === "INITIAL_PEEK", "round two peek");
check(
  "the next round includes connected seats and marks an offline seat out",
  context().turnOrder.length === 2 &&
    context().turnOrder.includes(disconnectedId) &&
    !context().turnOrder.includes(inactiveNextRoundId) &&
    context().players[disconnectedId].forfeited === false &&
    context().players[inactiveNextRoundId].forfeited === true &&
    context().players[inactiveNextRoundId].isLocked &&
    context().players[inactiveNextRoundId].hand.length === 0,
  `turnOrder=${JSON.stringify(context().turnOrder)}`,
);
for (const playerId of context().turnOrder) {
  send({ type: "DECLARE_READY_FOR_PEEK", playerId });
}

await waitFor((c) => c.gameStage === "PLAYING", "playing round two");
send({
  type: "PLAYER_RECONNECTED",
  playerId: inactiveNextRoundId,
  newSocketId: "s3b",
});
check(
  "reconnecting mid-round does not activate a seat that sat the deal out",
  context().players[inactiveNextRoundId].isConnected &&
    context().players[inactiveNextRoundId].forfeited &&
    !context().turnOrder.includes(inactiveNextRoundId),
);

table.callCheck();
await table.playUntil("SCORING");
check(
  "an offline-at-deal seat cannot win or accrue a zero round total",
  !context().gameover?.winnerIds.includes(inactiveNextRoundId) &&
    context().playerTotals[inactiveNextRoundId] === inactiveTotalBeforeRematch,
  `winners=${JSON.stringify(context().gameover?.winnerIds)} totals=${JSON.stringify(context().playerTotals)}`,
);

await waitFor((c) => c.gameStage === "GAMEOVER", "round two game over");
send({ type: "PLAY_AGAIN", playerId: host });
await waitFor((c) => c.gameStage === "INITIAL_PEEK", "round three peek");
check(
  "a reconnected spectator is dealt back into the following round",
  context().turnOrder.length === 3 &&
    PLAYERS.every((playerId) => context().turnOrder.includes(playerId)) &&
    new Set(context().turnOrder).size === 3 &&
    context().players[inactiveNextRoundId].forfeited === false,
  `turnOrder=${JSON.stringify(context().turnOrder)}`,
);
for (const playerId of PLAYERS) {
  send({ type: "DECLARE_READY_FOR_PEEK", playerId });
}

await waitFor((c) => c.gameStage === "PLAYING", "playing round three");
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
    if (context().currentPlayerId !== disconnectedBeforeTurn) {
      table.step();
    }
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
  deck = [{ id: "scenario-deck-card", rank: "3", suit: "S" }],
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
      deck,
    },
    status: "active",
  });
  const scenario = tableFor(createActor(gameMachine, { snapshot: state }));
  scenario.actor.start();
  return scenario;
};

const matchingDropActor = scenarioActor({
  players: {
    host: scenarioPlayer("host"),
    other: scenarioPlayer("other"),
    third: scenarioPlayer("third"),
  },
  turnOrder: ["host", "other", "third"],
  gameMasterId: "host",
  currentPlayerId: "host",
  deck: [
    { id: "matching-next-card", rank: "4", suit: "S" },
    { id: "matching-card", rank: "3", suit: "S" },
  ],
});
matchingDropActor.send({ type: "DRAW_FROM_DECK", playerId: "host" });
matchingDropActor.send({ type: "DISCARD_DRAWN_CARD", playerId: "host" });
matchingDropActor.send({ type: "PLAYER_DISCONNECTED", playerId: "host" });
for (const playerId of matchingDropActor.snapshot().context.matchingOpportunity
  ?.remainingPlayerIDs ?? []) {
  matchingDropActor.send({ type: "PASS_ON_MATCH_ATTEMPT", playerId });
}
const matchingDropContext = matchingDropActor.snapshot().context;
check(
  "disconnecting during matching waits for the player's next decision window",
  !matchingDropContext.players.host.forfeited &&
    matchingDropContext.currentPlayerId === "other" &&
    matchingDropContext.currentTurnSegment === "DRAW",
  `stage=${matchingDropContext.gameStage} current=${matchingDropContext.currentPlayerId}`,
);
matchingDropActor.stop();

const abilityDropActor = scenarioActor({
  players: {
    host: scenarioPlayer("host"),
    other: scenarioPlayer("other"),
  },
  turnOrder: ["host", "other"],
  gameMasterId: "host",
  currentPlayerId: "host",
  deck: [{ id: "ability-card", rank: "J", suit: "S" }],
});
abilityDropActor.send({ type: "DRAW_FROM_DECK", playerId: "host" });
abilityDropActor.send({ type: "DISCARD_DRAWN_CARD", playerId: "host" });
for (const playerId of abilityDropActor.snapshot().context.matchingOpportunity
  ?.remainingPlayerIDs ?? []) {
  abilityDropActor.send({ type: "PASS_ON_MATCH_ATTEMPT", playerId });
}
const abilityDeadline = abilityDropActor.snapshot().context.turnDeadline;
const abilityDisconnectAt = Date.now();
abilityDropActor.send({ type: "PLAYER_DISCONNECTED", playerId: "host" });
await sleep(50);
check(
  "disconnecting during an owned ability keeps its ordinary deadline armed",
  !abilityDropActor.snapshot().context.players.host.forfeited &&
    abilityDropActor.snapshot().context.currentTurnSegment === "ABILITY" &&
    abilityDropActor.snapshot().context.turnDeadline === abilityDeadline,
  `deadline=${abilityDropActor.snapshot().context.turnDeadline}`,
);
await abilityDropActor.waitFor(
  (c) => c.players.host.forfeited === true,
  "ability owner to forfeit after the ordinary window",
  5_000,
);
const abilityElapsed = Date.now() - abilityDisconnectAt;
check(
  "an offline ability owner forfeits after one ordinary window",
  abilityElapsed >= 900 && abilityElapsed < 4_000,
  `elapsed=${abilityElapsed}ms`,
);
abilityDropActor.stop();

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
const tieContext = tieActor.snapshot().context;
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
finalTurnHostActor.send({ type: "PLAYER_DISCONNECTED", playerId: "other" });
finalTurnHostActor.send({ type: "PLAYER_DISCONNECTED", playerId: "host" });
await finalTurnHostActor.waitFor(
  (c) => c.players.host.forfeited === true,
  "final-turn host to forfeit",
  5_000,
);
const finalTurnHostContext = finalTurnHostActor.snapshot().context;
check(
  "a forfeiting host stays recoverable when everyone is offline",
  finalTurnHostContext.gameMasterId === "host" &&
    finalTurnHostContext.gameStage === "SCORING",
  `gameMasterId=${finalTurnHostContext.gameMasterId} stage=${finalTurnHostContext.gameStage}`,
);
finalTurnHostActor.send({
  type: "PLAYER_RECONNECTED",
  playerId: "other",
  newSocketId: "socket-other-returned",
});
finalTurnHostActor.send({
  type: "PLAYER_RECONNECTED",
  playerId: "host",
  newSocketId: "socket-host-returned",
});
check(
  "reconnecting after an all-offline forfeit leaves a game master in control",
  finalTurnHostActor.snapshot().context.gameMasterId === "host",
);
finalTurnHostActor.stop();

table.stop();

check("the actor never entered an error state", table.errors.length === 0);
finish({
  passed: (checks) =>
    `Disconnect/forfeit lifecycle is correct (${checks} checks).`,
  failed: (failures) =>
    `\n${failures} disconnect/forfeit check${failures === 1 ? "" : "s"} failed.`,
});
