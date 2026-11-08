// Plays seeded random games against the real machine and checks the rules in
// scripts/lib/invariants.mjs after every event. The moves are random but never
// judged: the machine refuses what the rules forbid, and the invariants decide
// whether what it allowed was right.
//
// Players also drop and return at random points of the turn. One who has to
// act is brought back first, so nothing waits on the turn timer running out.
// check-disconnect-forfeit.mjs covers what happens when it does.
//
// A failure names its game, and rerunning plays the same game: the deal and
// every move come from the seed, and no move waits on a timer short enough to
// race it.
//
// Run from the repo root, after npm run build:server-deps.

import { createSeededRng } from "../server/dist/lib/rng.js";
import { createInvariants, RULES } from "./lib/invariants.mjs";
import { loadGame, sleep } from "./lib/game.mjs";
import { createReport } from "./lib/report.mjs";

const SEEDS = 6;
const ROUNDS = 2;

const { openTable, generatePlayerView } = await loadGame({
  PEEK_DURATION_MS: 5,
  ABILITY_PEEK_VIEW_DURATION_MS: 5,
  SCORING_DURATION_MS: 5,
  MATCHING_STAGE_DURATION_MS: 600_000,
  TURN_TIMER_MS: 600_000,
  MAX_PLAYERS: 6,
});
// The machine logs every turn phase at info, which buries the report. The
// logger has to be loaded after loadGame has set the environment.
const { default: logger } = await import("../server/dist/lib/logger.js");
logger.level = "warn";

const report = createReport();
const broken = new Map();
const seen = {
  rounds: 0,
  turns: 0,
  finalTurns: 0,
  matches: 0,
  penalties: 0,
  abilities: 0,
  reshuffles: 0,
  disqualified: 0,
  drops: 0,
  returns: 0,
  satOut: 0,
};
const UNDISTURBED = "a drop or a return leaves the turn as it was";

const filled = (hand) => hand.flatMap((card, index) => (card ? [index] : []));
const pick = (r, list) => list[Math.floor(r() * list.length)];
const shuffled = (r, list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const canMove = (c) => {
  if (c.gameStage !== "PLAYING" && c.gameStage !== "FINAL_TURNS") return false;
  if (c.currentTurnSegment === "MATCHING") return !!c.matchingOpportunity;
  if (c.currentTurnSegment === "ABILITY") {
    const ability = c.abilityStack.at(-1);
    return !!ability && !(ability.stage === "peeking" && c.publicPeek);
  }
  return ["DRAW", "DISCARD"].includes(c.currentTurnSegment);
};

// Returns false, without drawing a number, when only a timer can move the game.
// Drawing one while waiting would make the moves depend on how long the wait
// took, and the seed would stop naming the game.
const move = (table, c, r, style) => {
  if (!canMove(c)) return false;
  const send = (type, playerId, payload) => {
    if (style.away.has(playerId)) style.setAway(playerId, false);
    table.send({ type, playerId, payload });
  };
  const roll = r();
  const present = Object.keys(c.players).filter((id) => !style.away.has(id));
  if (roll < 0.04 && present.length > 1) {
    style.setAway(pick(r, present), true);
  } else if (roll > 0.96 && style.away.size) {
    style.setAway(pick(r, [...style.away]), false);
  }
  const id = c.currentPlayerId;
  const me = c.players[id];

  if (c.currentTurnSegment === "DRAW") {
    style.turns++;
    if (
      c.gameStage === "PLAYING" &&
      style.turns > style.checkAfter &&
      r() < 0.15
    ) {
      send("CALL_CHECK", id);
      return true;
    }
    if (r() < 0.3) {
      send("DRAW_FROM_DISCARD", id);
      if (table.context().players[id].pendingDrawnCard) return true;
    }
    send("DRAW_FROM_DECK", id);
    return true;
  }

  if (c.currentTurnSegment === "DISCARD") {
    const slots = filled(me.hand);
    if (
      me.pendingDrawnCard.source === "discard" ||
      (slots.length && r() < 0.6)
    ) {
      send("SWAP_AND_DISCARD", id, { handCardIndex: pick(r, slots) });
    } else {
      send("DISCARD_DRAWN_CARD", id);
    }
    return true;
  }

  if (c.currentTurnSegment === "MATCHING" && c.matchingOpportunity) {
    const { rank } = c.matchingOpportunity.cardToMatch;
    for (const playerId of c.matchingOpportunity.remainingPlayerIDs) {
      const hand = c.players[playerId].hand;
      const right = filled(hand).filter((i) => hand[i].rank === rank);
      const wrong = filled(hand).filter((i) => hand[i].rank !== rank);
      const roll = r();
      if (right.length && roll < 0.75) {
        send("ATTEMPT_MATCH", playerId, { handCardIndex: right[0] });
        seen.matches++;
        return true;
      }
      if (wrong.length && roll > 1 - style.misplay) {
        send("ATTEMPT_MATCH", playerId, { handCardIndex: pick(r, wrong) });
        seen.penalties++;
      } else {
        send("PASS_ON_MATCH_ATTEMPT", playerId);
      }
    }
    return true;
  }

  if (c.currentTurnSegment === "ABILITY") {
    const ability = c.abilityStack.at(-1);
    const targets = Object.values(c.players)
      .filter((p) => !p.isLocked)
      .flatMap((p) =>
        filled(p.hand).map((cardIndex) => ({ playerId: p.id, cardIndex })),
      );
    const use = (payload) => send("USE_ABILITY", ability.playerId, payload);
    seen.abilities++;
    if (targets.length < 2 || r() < 0.2) {
      use({ action: "skip" });
    } else if (ability.stage === "peeking") {
      use({
        action: "peek",
        targets: shuffled(r, targets).slice(0, ability.remainingPeeks ?? 1),
      });
    } else {
      const [source, target] = shuffled(r, targets);
      use({ action: "swap", source, target });
    }
    return true;
  }
  return false;
};

const playGame = async (count, seed) => {
  const name = `${count} players, seed ${seed}`;
  const breaks = (rule, detail) => {
    const entry = broken.get(rule) ?? { times: 0, first: `${name}: ${detail}` };
    entry.times++;
    broken.set(rule, entry);
  };
  const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const table = openTable({
    gameId: `g${count}s${seed}`,
    seed,
    players,
    label: name,
  });
  const invariants = createInvariants(generatePlayerView);

  // Only the connection may change. Anything else here moving means the drop or
  // the return reset or advanced the turn in flight.
  const turnState = (c) =>
    JSON.stringify([
      c.gameStage,
      c.currentTurnSegment,
      c.currentPlayerId,
      c.turnDeadline,
      c.abilityStack,
      c.matchingOpportunity,
      c.checkDetails,
      c.deck,
      c.discardPile,
      Object.values(c.players).map((p) => [
        p.hand,
        p.pendingDrawnCard,
        p.isLocked,
        p.status,
        p.forfeited,
      ]),
    ]);
  const away = new Set();
  let socketCount = 0;
  const setAway = (playerId, gone) => {
    const before = turnState(table.context());
    table.send(
      gone
        ? { type: "PLAYER_DISCONNECTED", playerId }
        : {
            type: "PLAYER_RECONNECTED",
            playerId,
            newSocketId: `s-${playerId}-${++socketCount}`,
          },
    );
    if (turnState(table.context()) !== before) {
      const c = table.context();
      breaks(
        UNDISTURBED,
        `${playerId} ${gone ? "dropped" : "returned"} at ${c.gameStage} ${c.currentTurnSegment}`,
      );
    }
    if (gone) {
      away.add(playerId);
      seen.drops++;
    } else {
      away.delete(playerId);
      seen.returns++;
    }
  };
  let deckSize = null;
  table.actor.subscribe((snapshot) => {
    const c = snapshot.context;
    for (const { rule, detail } of invariants.observe(c)) breaks(rule, detail);
    const inPlay = c.gameStage === "PLAYING" || c.gameStage === "FINAL_TURNS";
    if (inPlay && deckSize !== null && c.deck.length > deckSize)
      seen.reshuffles++;
    deckSize = inPlay ? c.deck.length : null;
  });

  // The driver's numbers come from their own stream, so a change to how the
  // machine draws cannot change the moves.
  const r = createSeededRng(seed * 7919 + count).float;
  try {
    table.readyLobby();
    await table.startRound("p1");
    for (let round = 1; round <= ROUNDS; round++) {
      // Some games call Check early, some only once the deck has been rebuilt,
      // and some misplay often enough to reach disqualification.
      const style = {
        away,
        setAway,
        turns: 0,
        checkAfter: [0, 30, 120][seed % 3],
        misplay: [0.02, 0.1, 0.35][seed % 3],
      };
      let idleSince = Date.now();
      while (table.context().gameStage !== "GAMEOVER") {
        if (style.turns > 1000)
          throw new Error(`round ${round} passed 1000 turns`);
        if (move(table, table.context(), r, style)) {
          idleSince = Date.now();
          await new Promise(setImmediate);
          continue;
        }
        if (Date.now() - idleSince > 3000) {
          const c = table.context();
          throw new Error(
            `round ${round} stuck at ${c.gameStage} ${c.currentTurnSegment}`,
          );
        }
        await sleep(1);
      }
      const c = table.context();
      seen.rounds++;
      seen.turns += style.turns;
      seen.disqualified += Object.values(c.players).filter(
        (p) => p.status === "DISQUALIFIED",
      ).length;
      if (c.checkDetails) seen.finalTurns++;
      if (round < ROUNDS) {
        // Whoever is still away at the deal sits the round out (11.D). The host
        // has to be present to deal, and so do two players.
        if (away.has(c.gameMasterId)) setAway(c.gameMasterId, false);
        while (count - away.size < 2) setAway([...away][0], false);
        seen.satOut += away.size;
        table.send({ type: "PLAY_AGAIN", playerId: c.gameMasterId });
        await table.playThroughPeek();
      }
    }
  } catch (error) {
    breaks("every round ends", error.message);
  }
  for (const error of table.errors)
    breaks("the machine raises no error", String(error?.message ?? error));
  table.stop();
};

const games = [];
for (let count = 2; count <= 6; count++) {
  for (let seed = 1; seed <= SEEDS; seed++) games.push(playGame(count, seed));
}
await Promise.all(games);

const rules = [
  ...Object.values(RULES),
  UNDISTURBED,
  "every round ends",
  "the machine raises no error",
];
for (const rule of rules) {
  const entry = broken.get(rule);
  report.check(
    rule,
    !entry,
    entry ? `broken ${entry.times} times, first in ${entry.first}` : "",
  );
}

// A driver that stopped reaching part of the game would pass every rule above
// while checking less, so the games have to keep covering all of it.
const missing = Object.entries(seen)
  .filter(([, n]) => n === 0)
  .map(([what]) => what);
report.check(
  "the games reach every part of a round",
  missing.length === 0,
  missing.length ? `never saw ${missing.join(", ")}` : "",
);
console.log(
  `  ${games.length} games: ${Object.entries(seen)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}`,
);

report.finish({
  passed: (checks) => `Random play kept the rules (${checks} checks).`,
  failed: (failures) => `
${failures} random play check${failures === 1 ? "" : "s"} failed.

Each failure names the first game that broke it. The games are seeded, so
running this again replays the same moves. docs/GAME_RULES.md decides whether
the machine or the invariant is wrong.`,
});
