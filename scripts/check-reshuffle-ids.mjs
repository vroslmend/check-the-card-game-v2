// Guards what a player can work out once the deck has been rebuilt. Every card in
// the discard pile was seen face up, id included, so a card that goes back into
// the deck under the same id can be recognised wherever it turns up: on deckTop,
// or face down in a hand. docs/GAME_RULES.md and SECURITY.md both treat the order
// of the deck as hidden.
//
// The lock in section 7 is stored by id, so a new id must not free a matched card.
//
// Run from the repo root, after npm run build:server-deps.

import { loadGame, sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const { openTable, generatePlayerView } = await loadGame({
  PEEK_DURATION_MS: 5,
  MATCHING_STAGE_DURATION_MS: 200,
  ABILITY_PEEK_VIEW_DURATION_MS: 5,
  TURN_TIMER_MS: 60_000,
});

const report = createReport();
const name = (card) => `${card.rank}${card.suit}`;

const allCards = (context) => [
  ...context.deck,
  ...context.discardPile,
  ...Object.values(context.players).flatMap((p) => [
    ...p.hand.filter(Boolean),
    ...(p.pendingDrawnCard ? [p.pendingDrawnCard.card] : []),
  ]),
];

const openGame = async (id) => {
  const table = openTable({
    gameId: id,
    seed: 7,
    players: ["a", "b"],
    label: id,
  });
  table.readyLobby();
  await table.startRound("a");

  // What a client that keeps everything it receives knows, as player a.
  const seenFaceUp = new Set();
  const look = () => {
    const view = generatePlayerView(table.snapshot(), "a");
    for (const card of view.discardPile) seenFaceUp.add(card.id);
    if (view.players.a.pendingDrawnCard?.card.rank) {
      seenFaceUp.add(view.players.a.pendingDrawnCard.card.id);
    }
    return view;
  };

  const playUntil = async (reached, onMatching) => {
    const deadline = Date.now() + 30_000;
    while (!reached(table.context())) {
      if (Date.now() > deadline) throw new Error(`${id}: never got there`);
      look();
      if (table.context().currentTurnSegment === "MATCHING") onMatching?.();
      table.step();
      await sleep(1);
    }
    return look();
  };

  return { table, seenFaceUp, look, playUntil };
};

const assertUnrecognisable = (label, { table, seenFaceUp }, view) => {
  const { deck } = table.context();
  const known = deck.filter((card) => seenFaceUp.has(card.id));
  report.check(
    `${label}: no card in the rebuilt deck keeps an id seen face up`,
    deck.length > 0 && known.length === 0,
    `${known.length} of ${deck.length} recognisable`,
  );
  report.check(
    `${label}: the next draw cannot be read from deckTop`,
    view.deckTop !== null && !seenFaceUp.has(view.deckTop.id),
  );
  const names = new Set(allCards(table.context()).map(name));
  report.check(
    `${label}: all 52 cards are still in the game`,
    names.size === 52 && allCards(table.context()).length === 52,
    `${names.size} distinct`,
  );
};

// Section 11.A, when the player about to draw finds the deck empty.
{
  const game = await openGame("reshuffle-on-draw");
  let topBefore = null;
  const view = await game.playUntil((c) => {
    if (c.deck.length === 0) topBefore = c.discardPile.at(-1);
    return topBefore !== null && c.deck.length > 0;
  });
  assertUnrecognisable("on a draw", game, view);
  report.check(
    "on a draw: the top of the discard pile stays where it is",
    game.table.context().discardPile.at(-1)?.id === topBefore.id &&
      game.table.context().discardPile.length === 1,
  );
  game.table.stop();
}

// The penalty path rebuilds the deck on its own, mid matching window.
{
  const game = await openGame("reshuffle-on-penalty");
  await game.playUntil(
    (c) => c.deck.length === 0 && c.currentTurnSegment === "MATCHING",
  );
  const { matchingOpportunity, players } = game.table.context();
  const { cardToMatch, remainingPlayerIDs } = matchingOpportunity;
  const playerId = remainingPlayerIDs[0];
  const handCardIndex = players[playerId].hand.findIndex(
    (card) => card && card.rank !== cardToMatch.rank,
  );
  game.table.send({
    type: "ATTEMPT_MATCH",
    playerId,
    payload: { handCardIndex },
  });
  const after = game.table.context();
  const penaltyCard =
    after.players[playerId].hand[after.publicPenalty.cardIndex];
  assertUnrecognisable("on a penalty", game, game.look());
  report.check(
    "on a penalty: the penalty card cannot be recognised either",
    !game.seenFaceUp.has(penaltyCard.id),
  );
  game.table.stop();
}

// Section 7: a matched card stays locked for the rest of the round, even if it
// goes back through the deck.
{
  const game = await openGame("reshuffle-keeps-locks");
  const { table } = game;
  const tryToMatch = () => {
    const c = table.context();
    if (c.lockedCardIds.length > 0 || !c.matchingOpportunity) return;
    for (const playerId of c.matchingOpportunity.remainingPlayerIDs) {
      const handCardIndex = c.players[playerId].hand.findIndex(
        (card) => card?.rank === c.matchingOpportunity.cardToMatch.rank,
      );
      if (handCardIndex >= 0) {
        table.send({
          type: "ATTEMPT_MATCH",
          playerId,
          payload: { handCardIndex },
        });
        return;
      }
    }
  };

  let lockedNames = null;
  await game.playUntil((c) => {
    if (c.deck.length === 0 && c.lockedCardIds.length > 0) {
      lockedNames = allCards(c)
        .filter((card) => c.lockedCardIds.includes(card.id))
        .map(name);
    }
    return lockedNames !== null && c.deck.length > 0;
  }, tryToMatch);

  const after = table.context();
  const stillLocked = allCards(after)
    .filter((card) => after.lockedCardIds.includes(card.id))
    .map(name);
  report.check(
    "a matched card is still locked after going back through the deck",
    lockedNames.length > 0 &&
      lockedNames.every((card) => stillLocked.includes(card)),
    `${lockedNames.join(" ")} became ${stillLocked.join(" ")}`,
  );
  table.stop();
}

report.finish({
  passed: (n) => `A rebuilt deck cannot be read (${n} checks).`,
  failed: (n) => `${n} check(s) failed.`,
});
