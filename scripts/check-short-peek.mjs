// Guards the property #52 exists to provide: a peek confirmed at fewer targets
// than the ability grants still resolves. docs/GAME_RULES.md section 8 says the
// peek counts are maximums, not requirements, which matters because a matched
// King pair pools four peeks and the table often holds fewer than four cards
// once hands shrink and locked players are off limits.
//
// The trap is that the peek count is read in two places that must agree. The
// player's confirm clears remainingPeeks, and schedulePeekToSwap arms the peek
// to swap timer only once remainingPeeks is gone. Leave a remainder behind and
// the ability sits in the peeking stage with nothing left to advance it, the
// client waits in viewingPeek for a stage change that never comes, and the turn
// timer eventually fizzles the ability, costing the player the swap as well.
// #52 was closed once with only the client's button gate fixed, which is the
// half of the path this script cannot see. It watches the server half.
//
// Drives the real compiled gameMachine through a real two player round rather
// than asserting against a reimplementation, and pairs every short peek with a
// full count peek on the same seed as a control.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "150";
process.env.MATCHING_STAGE_DURATION_MS = "300";
// Long enough that a missing stage flip cannot be mistaken for an ability that
// simply fizzled first. The peek view window is a hardcoded 5000ms (#73).
process.env.TURN_TIMER_MS = "20000";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const ABILITY_PEEK_VIEW_DURATION_MS = 5000;
const P1 = "player-1";
const P2 = "player-2";

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Plays a seeded round until its first peek capable ability, spends it at
// `mode` targets, then reports what the ability did next.
async function playToPeek(mode, seed) {
  const actor = createActor(gameMachine, {
    input: { gameId: `CHECK-SHORTPEEK-${mode}`, seed },
  });
  actor.start();
  const snap = () => actor.getSnapshot();
  const send = (e) => actor.send(e);
  const top = () => snap().context.abilityStack.at(-1) ?? null;

  send({
    type: "PLAYER_JOIN_REQUEST",
    playerSetupData: { name: "P1", socketId: "s1" },
    playerId: P1,
  });
  send({
    type: "PLAYER_JOIN_REQUEST",
    playerSetupData: { name: "P2", socketId: "s2" },
    playerId: P2,
  });
  send({ type: "DECLARE_LOBBY_READY", playerId: P1 });
  send({ type: "DECLARE_LOBBY_READY", playerId: P2 });
  send({ type: "START_GAME", playerId: P1 });

  const result = {
    granted: 0,
    sent: 0,
    accepted: false,
    remaining: "n/a",
    outcome: "no peek ability reached",
  };
  let readySent = false;
  let confirmedAt = null;
  let confirmedId = null;

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const s = snap();
    if (s.status !== "active") break;
    const v = s.value;
    const c = s.context;

    if (v === "WAITING_FOR_PLAYERS" || v === "DEALING") {
      await sleep(10);
      continue;
    }
    if (typeof v === "object" && v.INITIAL_PEEK) {
      if (v.INITIAL_PEEK === "waitingForReady" && !readySent) {
        send({ type: "DECLARE_READY_FOR_PEEK", playerId: P1 });
        send({ type: "DECLARE_READY_FOR_PEEK", playerId: P2 });
        readySent = true;
      }
      await sleep(10);
      continue;
    }

    if (confirmedAt) {
      const since = Date.now() - confirmedAt;
      const a = top();
      if (!a || a.sourceCard.id !== confirmedId) {
        result.outcome = `fizzled after ${since}ms without reaching the swap stage`;
        break;
      }
      if (a.stage === "swapping") {
        result.outcome = "reached the swap stage";
        break;
      }
      if (since > ABILITY_PEEK_VIEW_DURATION_MS + 2000) {
        result.outcome = `stuck in the peeking stage ${since}ms after the peek`;
        break;
      }
      await sleep(50);
      continue;
    }

    const turnV =
      typeof v === "object" ? (v.PLAYING?.turn ?? v.FINAL_TURNS?.turn) : null;

    if (turnV === "DRAW") {
      send({ type: "DRAW_FROM_DECK", playerId: c.currentPlayerId });
      await sleep(5);
      continue;
    }
    if (turnV === "DISCARD") {
      send({ type: "DISCARD_DRAWN_CARD", playerId: c.currentPlayerId });
      await sleep(5);
      continue;
    }
    if (turnV === "matching") {
      const rem = c.matchingOpportunity?.remainingPlayerIDs ?? [];
      if (rem.length) send({ type: "PASS_ON_MATCH_ATTEMPT", playerId: rem[0] });
      await sleep(5);
      continue;
    }

    if (turnV === "ability" && top()) {
      const a = top();
      const granted = a.remainingPeeks ?? 0;
      const owner = a.playerId;
      if (granted === 0) {
        // A Jack has no peek stage to spend.
        send({
          type: "USE_ABILITY",
          playerId: owner,
          payload: { action: "skip" },
        });
        await sleep(5);
        continue;
      }
      const other = owner === P1 ? P2 : P1;
      const usable = snap()
        .context.players[other].hand.map((card, i) => (card ? i : -1))
        .filter((i) => i >= 0);
      const want = mode === "short" ? granted - 1 : granted;
      const n = Math.min(Math.max(want, 1), usable.length);
      if (mode === "short" && n >= granted) {
        // Not a short list, so it would prove nothing. Take the next ability.
        send({
          type: "USE_ABILITY",
          playerId: owner,
          payload: { action: "skip" },
        });
        await sleep(5);
        continue;
      }
      const targets = usable
        .slice(0, n)
        .map((i) => ({ playerId: other, cardIndex: i }));

      result.granted = granted;
      result.sent = targets.length;
      send({
        type: "USE_ABILITY",
        playerId: owner,
        payload: { action: "peek", targets },
      });
      await sleep(30);

      const after = top();
      result.accepted = !!after && after.sourceCard.id === a.sourceCard.id;
      result.remaining = result.accepted
        ? (after.remainingPeeks ?? "cleared")
        : "n/a";
      confirmedAt = Date.now();
      confirmedId = a.sourceCard.id;
      continue;
    }

    if (v === "SCORING" || v === "GAMEOVER") break;
    await sleep(10);
  }

  actor.stop();
  return result;
}

const SEED = 20260818;

const short = await playToPeek("short", SEED);
console.log(
  `\nA peek spent at ${short.sent} of ${short.granted} granted targets:`,
);
check("the server accepts a short peek", short.accepted);
check(
  "confirming clears the remaining peeks",
  short.remaining === "cleared",
  `remainingPeeks: ${short.remaining}`,
);
check(
  "the ability goes on to the swap stage",
  short.outcome === "reached the swap stage",
  short.outcome,
);

const full = await playToPeek("full", SEED);
console.log(`\nControl, a peek spent at all ${full.granted} granted targets:`);
check("the server accepts a full peek", full.accepted);
check(
  "confirming clears the remaining peeks",
  full.remaining === "cleared",
  `remainingPeeks: ${full.remaining}`,
);
check(
  "the ability goes on to the swap stage",
  full.outcome === "reached the swap stage",
  full.outcome,
);

if (failures > 0) {
  console.error(`
${failures} short peek failure${failures === 1 ? "" : "s"}.

A player granted more peeks than the table can offer has to be able to spend
what is there and move on. An ability left in the peeking stage with peeks
remaining cannot advance, so the player waits out the turn timer with nothing
to press and loses the swap too. Treat a failure here as the game being wrong
rather than this script, and check it against Special Card Abilities in
docs/GAME_RULES.md.`);
  process.exit(1);
}

console.log("\nA peek confirmed short of its maximum still resolves.");
