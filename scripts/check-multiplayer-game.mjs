// Plays a whole game over real sockets against the compiled server, three
// players connected the way a browser connects, and checks what only exists
// with several clients: each gets a view redacted for it, private messages
// reach only their owner, two players racing for one match cannot both win it,
// a forged internal event goes nowhere, and a player who drops and rejoins finds
// the turn where it was.
//
// The bots play only from what their own client could know: the cards from the
// opening peek, every card they draw and every card they peek at, all by id.
// That is enough to set up a real race, two players each holding a card of the
// rank just discarded.
//
// Run from the repo root, after npm run build:server-deps.

import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";
import { sleep } from "./lib/game.mjs";

const server = await startServer({
  PEEK_DURATION_MS: 50,
  ABILITY_PEEK_VIEW_DURATION_MS: 50,
  SCORING_DURATION_MS: 50,
  MATCHING_STAGE_DURATION_MS: 600_000,
  TURN_TIMER_MS: 600_000,
  LOBBY_DISCONNECT_TIMEOUT_MS: 600_000,
  PLAYER_ACTION_RATE_LIMIT: 1_000_000,
});
// The machine logs every turn phase at info, which buries the report. The
// logger has to be loaded after startServer has set the environment.
const { default: logger } = await import("../server/dist/lib/logger.js");
logger.level = "warn";
const { check, finish } = createReport();

const REVEALED = new Set(["SCORING", "GAMEOVER"]);
const SPECIAL = new Set(["K", "Q", "J"]);
const inPlay = (s) =>
  s.gameStage === "PLAYING" || s.gameStage === "FINAL_TURNS";
const walk = (value, visit) => {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (value && typeof value === "object") {
    visit(value);
    Object.values(value).forEach((item) => walk(item, visit));
  }
};

const faults = new Map();
const fault = (rule, detail) => {
  const entry = faults.get(rule) ?? { times: 0, first: detail };
  entry.times++;
  faults.set(rule, entry);
};
const RULES = {
  addressed: "every view is addressed to the client that receives it",
  hidden: "no client receives the face of a face down card",
  draw: "a deck draw shows its face to the drawer and nobody else",
  openingPeek: "the opening peek reaches only its owner, with their own cards",
  abilityPeek: "an ability peek's result reaches only the peeker",
};

// One client per seat. A seat that rejoins gets a new client in its place.
const live = new Map();
const known = new Map();
const openingPeeks = new Map();
const peekResults = [];

const learn = (seatId, card) => known.get(seatId).set(card.id, card.rank);

const checkView = (seatId, s) => {
  if (s.viewingPlayerId !== seatId) {
    fault(RULES.addressed, `${seatId} was sent ${s.viewingPlayerId}'s view`);
  }
  if (REVEALED.has(s.gameStage)) return;
  const hidden = new Set(s.deckTop ? [s.deckTop.id] : []);
  for (const p of Object.values(s.players)) {
    p.hand.forEach((card) => card && hidden.add(card.id));
    const drawn = p.pendingDrawnCard;
    if (drawn?.source === "deck" && p.id !== seatId) hidden.add(drawn.card.id);
  }
  walk(s, (o) => {
    if (hidden.has(o.id) && ("rank" in o || "suit" in o)) {
      fault(RULES.hidden, `${seatId} saw ${o.id} at ${s.gameStage}`);
    }
  });
};

const wire = (client, seatId) => {
  if (!known.has(seatId)) known.set(seatId, new Map());
  client.on((s) => checkView(seatId, s));
  client.socket.on("INITIAL_PEEK_INFO", ({ hand }) => {
    openingPeeks.set(seatId, [...(openingPeeks.get(seatId) ?? []), hand]);
    hand.forEach((card) => learn(seatId, card));
  });
  client.socket.on("ABILITY_PEEK_RESULT", ({ results }) => {
    peekResults.push({ to: seatId, results });
    results.forEach(({ card }) => learn(seatId, card));
  });
  live.set(seatId, client);
};

const all = (predicate, label) =>
  Promise.all([...live.values()].map((c) => c.waitFor(predicate, label)));
const next = (client) =>
  new Promise((resolve) => {
    const once = (s) => {
      client.off(once);
      resolve(s);
    };
    client.on(once);
  });

// The slot in a seat's own hand holding a card of this rank, as far as that
// seat knows, or -1.
const knownSlot = (seatId, rank) => {
  const hand = live.get(seatId).state.players[seatId].hand;
  return hand.findIndex((c) => c && known.get(seatId).get(c.id) === rank);
};

const [alice, bob, cara] = ["Alice", "Bob", "Cara"].map((name) =>
  server.player(name),
);
const gameId = await alice.createGame({ seats: 3 });
await bob.joinGame(gameId);
await cara.joinGame(gameId);
for (const client of [alice, bob, cara]) wire(client, client.id);
await all((s) => Object.keys(s.players).length === 3, "everyone seated");

for (const client of [alice, bob, cara]) client.act("DECLARE_LOBBY_READY");
await all((s) => Object.values(s.players).every((p) => p.isReady), "ready");
alice.act("START_GAME");
await all((s) => s.gameStage === "INITIAL_PEEK", "the opening peek");
for (const client of live.values()) client.act("DECLARE_READY_FOR_PEEK");
await all((s) => s.gameStage === "PLAYING", "the first turn");

{
  const hands = Object.fromEntries(
    [...live.keys()].map((id) => [
      id,
      new Set(alice.state.players[id].hand.map((c) => c.id)),
    ]),
  );
  for (const [seatId, peeks] of openingPeeks) {
    const ids = peeks.flat().map((c) => c.id);
    const own = ids.every((id) => hands[seatId].has(id));
    const leaked = Object.entries(hands).some(
      ([other, set]) => other !== seatId && ids.some((id) => set.has(id)),
    );
    if (peeks.length !== 1 || ids.length !== 2 || !own || leaked) {
      fault(RULES.openingPeek, `${seatId} got ${peeks.length} with ${ids}`);
    }
  }
  if (openingPeeks.size !== 3) {
    fault(RULES.openingPeek, `${openingPeeks.size} of 3 seats got their peek`);
  }
}

const done = { race: false, abilityPeek: false, drop: false, spoof: false };
const turnSignature = (s) =>
  JSON.stringify([
    s.gameStage,
    s.turnPhase,
    s.currentPlayerId,
    s.turnDeadline,
    s.players[s.currentPlayerId]?.pendingDrawnCard?.card.id,
    s.deckSize,
    s.discardPile.at(-1)?.id,
  ]);

const dropAndRejoin = async (seatId) => {
  const old = live.get(seatId);
  const before = turnSignature(old.state);
  live.delete(seatId);
  old.disconnect();
  await all((s) => s.players[seatId].isConnected === false, "the drop");
  const fresh = server.player(old.name);
  await fresh.connected();
  const reply = await fresh.request("ATTEMPT_REJOIN", {
    gameId,
    playerId: seatId,
    token: old.reconnectToken,
  });
  check("a dropped player rejoins with their token", reply?.success === true);
  fresh.id = seatId;
  fresh.gameId = gameId;
  fresh.reconnectToken = reply?.reconnectToken ?? old.reconnectToken;
  wire(fresh, seatId);
  await all((s) => s.players[seatId].isConnected === true, "the return");
  const after = [...live.values()].map((c) => turnSignature(c.state));
  check(
    "a player who drops and rejoins finds the turn where it was",
    after.every((sig) => sig === before),
    after.find((sig) => sig !== before) ?? "",
  );
  done.drop = true;
};

let turns = 0;
let races = 0;
while (turns < 300) {
  const [s] = await all(
    (s) => REVEALED.has(s.gameStage) || (inPlay(s) && s.turnPhase === "DRAW"),
    "a turn",
  );
  if (REVEALED.has(s.gameStage)) break;
  turns++;
  const current = s.currentPlayerId;
  const others = [...live.keys()].filter((id) => id !== current);

  if (!done.spoof) {
    // Forwarded, this would mark the sender away. The refused draw after it is
    // answered with their view, which says whether it was.
    const spoofer = live.get(others[0]);
    spoofer.act("PLAYER_DISCONNECTED");
    const answer = next(spoofer);
    spoofer.act("DRAW_FROM_DECK");
    const after = await answer;
    check(
      "a forged disconnect through PLAYER_ACTION changes nothing",
      after.players[others[0]].isConnected === true,
    );
    done.spoof = true;
  }

  if (
    s.gameStage === "PLAYING" &&
    ((done.race && done.abilityPeek && done.drop && turns > 6) || turns > 250)
  ) {
    live.get(current).act("CALL_CHECK");
    await all((s) => s.gameStage !== "PLAYING", "the Check");
    continue;
  }

  const drawer = live.get(current);
  drawer.act("DRAW_FROM_DECK");
  await all((s) => !!s.players[current].pendingDrawnCard, "the draw");
  const drawn = drawer.state.players[current].pendingDrawnCard.card;
  learn(current, drawn);
  for (const [id, client] of live) {
    const seen = client.state.players[current].pendingDrawnCard.card;
    const faceUp = "rank" in seen;
    if (seen.id !== drawn.id || faceUp !== (id === current)) {
      fault(
        RULES.draw,
        `${id} saw ${current}'s draw face ${faceUp ? "up" : "down"}`,
      );
    }
  }

  if (!done.drop && turns >= 2) await dropAndRejoin(others[0]);

  // A race needs two other players who each know they hold the rank thrown.
  const racers = (rank) =>
    others
      .filter((id) => !s.players[id].isLocked)
      .map((id) => [id, knownSlot(id, rank)])
      .filter(([, slot]) => slot >= 0)
      .slice(0, 2);
  const hand = drawer.state.players[current].hand;
  let race = null;
  if (
    races < 3 &&
    !SPECIAL.has(drawn.rank) &&
    racers(drawn.rank).length === 2
  ) {
    race = racers(drawn.rank);
    drawer.act("DISCARD_DRAWN_CARD");
  } else {
    const slot =
      races < 3
        ? hand.findIndex((c) => {
            const rank = c && known.get(current).get(c.id);
            return rank && !SPECIAL.has(rank) && racers(rank).length === 2;
          })
        : -1;
    if (slot >= 0) {
      race = racers(known.get(current).get(hand[slot].id));
      drawer.act("SWAP_AND_DISCARD", { handCardIndex: slot });
    } else if (!done.abilityPeek && ["K", "Q"].includes(drawn.rank)) {
      drawer.act("DISCARD_DRAWN_CARD");
    } else {
      const unknown = hand.findIndex((c) => c && !known.get(current).has(c.id));
      const into = unknown >= 0 ? unknown : hand.findIndex(Boolean);
      drawer.act("SWAP_AND_DISCARD", { handCardIndex: into });
    }
  }

  const [window] = await all(
    (s) => s.turnPhase !== "DISCARD" && !s.players[current].pendingDrawnCard,
    "the discard",
  );
  if (window.turnPhase === "MATCHING" && window.matchingOpportunity) {
    if (race) {
      const sizes = (st) =>
        Object.fromEntries(
          Object.values(st.players).map((p) => [
            p.id,
            p.hand.filter(Boolean).length,
          ]),
        );
      const before = sizes(window);
      // Both in the same tick, on two sockets.
      for (const [id, slot] of race) {
        live.get(id).act("ATTEMPT_MATCH", { handCardIndex: slot });
      }
      const [after] = await all((s) => s.turnPhase !== "MATCHING", "the race");
      const now = sizes(after);
      const winners = race.filter(([id]) => now[id] === before[id] - 1);
      const grew = Object.keys(now).filter((id) => now[id] > before[id]);
      check(
        `race ${races + 1}: two correct matches at once, one wins and the other keeps their card`,
        winners.length === 1 &&
          grew.length === 0 &&
          race.every(([id]) => now[id] >= before[id] - 1),
        `racers ${race.map(([id]) => id)}, before ${JSON.stringify(before)}, after ${JSON.stringify(now)}`,
      );
      races++;
      done.race = true;
    } else {
      for (const id of window.matchingOpportunity.remainingPlayerIDs) {
        live.get(id).act("PASS_ON_MATCH_ATTEMPT");
      }
    }
  }

  // Abilities: peek at another player's card once, skip everything else.
  for (;;) {
    const [st] = await all(
      (s) =>
        s.turnPhase !== "MATCHING" &&
        (s.turnPhase !== "ABILITY" ||
          (s.abilityStack.length > 0 &&
            !(s.abilityStack.at(-1).stage === "peeking" && s.publicPeek))),
      "the ability",
    );
    if (st.turnPhase !== "ABILITY") break;
    const ability = st.abilityStack.at(-1);
    const owner = live.get(ability.playerId);
    const stackBefore = JSON.stringify(st.abilityStack);
    const target = Object.values(st.players).find(
      (p) => p.id !== ability.playerId && !p.isLocked && p.hand.some(Boolean),
    );
    if (ability.stage === "peeking" && !done.abilityPeek && target) {
      const results = peekResults.length;
      const cardIndex = target.hand.findIndex(Boolean);
      owner.act("USE_ABILITY", {
        action: "peek",
        targets: [{ playerId: target.id, cardIndex }],
      });
      await owner.waitFor(
        () => peekResults.length > results,
        "the peek result",
      );
      await sleep(100);
      const sent = peekResults.slice(results);
      const right =
        sent.length === 1 &&
        sent[0].to === ability.playerId &&
        sent[0].results[0]?.card.id === target.hand[cardIndex].id;
      if (!right) {
        fault(
          RULES.abilityPeek,
          `sent to ${sent.map((r) => r.to)} for ${ability.playerId}`,
        );
      }
      done.abilityPeek = true;
    } else {
      owner.act("USE_ABILITY", { action: "skip" });
    }
    await all(
      (s) =>
        s.turnPhase !== "ABILITY" ||
        JSON.stringify(s.abilityStack) !== stackBefore,
      "the ability to move",
    );
  }
}

const results = await all((s) => s.gameStage === "GAMEOVER", "the results");
const outcome = (s) =>
  JSON.stringify([s.gameover?.winnerIds, s.gameover?.playerScores]);
check(
  "every client sees the same result",
  results.every((s) => outcome(s) === outcome(results[0])) &&
    !!results[0].gameover?.winnerIds?.length,
  outcome(results[0]),
);
check(
  "every hand is revealed at the end",
  results.every((s) =>
    Object.values(s.players).every((p) =>
      p.hand.every((c) => !c || "rank" in c),
    ),
  ),
);

for (const rule of Object.values(RULES)) {
  const entry = faults.get(rule);
  check(
    rule,
    !entry,
    entry ? `broken ${entry.times} times, first: ${entry.first}` : "",
  );
}
const missing = Object.entries(done)
  .filter(([, happened]) => !happened)
  .map(([what]) => what);
check(
  "the game reached every case above",
  missing.length === 0,
  missing.length ? `never reached ${missing.join(", ")}` : `${turns} turns`,
);

await server.close();
finish({
  passed: (checks) =>
    `\nThree clients played a full game over sockets (${checks} checks).`,
  failed: (failures) => `
${failures} multiplayer check${failures === 1 ? "" : "s"} failed.

These run the compiled server over real sockets. docs/GAME_RULES.md says what
each player may know and do; decide against it whether the server or this
check is wrong.`,
});
