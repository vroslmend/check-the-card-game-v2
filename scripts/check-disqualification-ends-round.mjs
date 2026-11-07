// Guards section 7 of docs/GAME_RULES.md: once disqualifications leave fewer than
// two active players, with no Check in progress, the round ends there and then.
//
// The trap is the matching window. It stays open after a disqualification, so if
// the round only ends with the turn, the survivor can be penalised out as well and
// a round that had a winner ends with none.
//
// Run from the repo root, after npm run build:server-deps.

import { loadGame, sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

// The window and the scoring hold are long so the state can be read before a timer
// moves it on.
const { openTable } = await loadGame({
  PEEK_DURATION_MS: 5,
  MATCHING_STAGE_DURATION_MS: 60_000,
  ABILITY_PEEK_VIEW_DURATION_MS: 5,
  SCORING_DURATION_MS: 60_000,
  TURN_TIMER_MS: 60_000,
});

const report = createReport();
const LIMIT = 8;

const cardsHeld = (table, playerId) =>
  table.context().players[playerId].hand.filter(Boolean).length;

const reachWindow = async (table, wanted = () => true) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const c = table.context();
    if (c.matchingOpportunity && wanted(c)) return;
    table.step();
    await sleep(1);
  }
  throw new Error("never reached the matching window this check needs");
};

const attemptWrongMatch = (table, playerId, rank) => {
  const handCardIndex = table
    .context()
    .players[playerId].hand.findIndex((card) => card && card.rank !== rank);
  table.send({ type: "ATTEMPT_MATCH", playerId, payload: { handCardIndex } });
};

const penaliseUpTo = (table, playerId, cards, rank) => {
  while (cardsHeld(table, playerId) < cards) {
    attemptWrongMatch(table, playerId, rank);
  }
};

const openGame = async (gameId, players) => {
  const table = openTable({ gameId, seed: gameId, players, label: gameId });
  table.readyLobby();
  await table.startRound(players[0]);
  return table;
};

{
  const table = await openGame("lone-survivor", ["a", "b"]);
  await reachWindow(table, (c) => c.abilityStack.length === 0);
  const { rank } = table.context().matchingOpportunity.cardToMatch;
  penaliseUpTo(table, "b", LIMIT - 1, rank);
  penaliseUpTo(table, "a", LIMIT, rank);

  report.check(
    "the round ends as soon as one active player is left",
    table.context().gameStage === "SCORING",
    `stage=${table.context().gameStage}`,
  );
  attemptWrongMatch(table, "b", rank);
  report.check(
    "the survivor cannot be penalised after that",
    cardsHeld(table, "b") === LIMIT - 1,
    `b holds ${cardsHeld(table, "b")}`,
  );
  report.check(
    "the survivor wins the round",
    table.context().gameover?.winnerIds?.join() === "b",
    `winners=${table.context().gameover?.winnerIds?.join()}`,
  );
  table.stop();
}

{
  const table = await openGame("pending-ability", ["a", "b"]);
  await reachWindow(table, (c) => c.abilityStack.length > 0);
  const { abilityStack, matchingOpportunity } = table.context();
  const owner = abilityStack.at(-1).playerId;
  const other = owner === "a" ? "b" : "a";
  penaliseUpTo(table, other, LIMIT, matchingOpportunity.cardToMatch.rank);

  report.check(
    "a pending ability does not hold the round open",
    table.context().gameStage === "SCORING",
    `stage=${table.context().gameStage} segment=${table.context().currentTurnSegment}`,
  );
  table.stop();
}

{
  const table = await openGame("two-still-active", ["a", "b", "c"]);
  await reachWindow(table, (c) => c.abilityStack.length === 0);
  const { rank } = table.context().matchingOpportunity.cardToMatch;
  penaliseUpTo(table, "c", LIMIT, rank);

  const { gameStage, matchingOpportunity } = table.context();
  report.check(
    "the round carries on while two players are active",
    gameStage === "PLAYING",
    `stage=${gameStage}`,
  );
  report.check(
    "the matching window stays open for them",
    matchingOpportunity?.remainingPlayerIDs.join() === "a,b",
    `remaining=${matchingOpportunity?.remainingPlayerIDs.join()}`,
  );
  table.stop();
}

{
  const table = await openGame("check-in-progress", ["a", "b", "c"]);
  await reachWindow(table, (c) => c.abilityStack.length === 0);
  for (const playerId of table.context().matchingOpportunity
    .remainingPlayerIDs) {
    table.send({ type: "PASS_ON_MATCH_ATTEMPT", playerId });
  }
  await table.waitFor(
    (c) => c.currentTurnSegment === "DRAW",
    "the next turn to start",
  );
  table.callCheck();
  await reachWindow(table, (c) => c.abilityStack.length === 0);

  const { matchingOpportunity } = table.context();
  const [first] = matchingOpportunity.remainingPlayerIDs;
  penaliseUpTo(table, first, LIMIT, matchingOpportunity.cardToMatch.rank);
  report.check(
    "with a Check in progress the final turns still play out",
    table.context().gameStage === "FINAL_TURNS",
    `stage=${table.context().gameStage}`,
  );
  await table.playUntil("SCORING");
  report.check(
    "and the round still finishes",
    table.context().gameStage === "SCORING",
    `stage=${table.context().gameStage}`,
  );
  table.stop();
}

report.finish({
  passed: (n) => `Disqualifications end the round on time (${n} checks).`,
  failed: (n) => `${n} check(s) failed.`,
});
