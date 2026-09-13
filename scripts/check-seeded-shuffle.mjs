// Guards the property step 1 of #36 exists to provide: a seeded game is
// reproducible, an unseeded one is not. Everything else planned in #36, replay
// of a failing random game from its seed alone, rests on this staying true.
//
// Exercises the real compiled deck utilities and the real machine, not a
// reimplementation.
//
// Run from the repo root, after npm run build:server-deps.

import { createReport } from "./lib/report.mjs";

const { createDeck, shuffleDeck } =
  await import("../server/dist/lib/deck-utils.js");
const { createSeededRng } = await import("../server/dist/lib/rng.js");
const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const { check, finish } = createReport();

const dealWith = (seed) => {
  const rng = createSeededRng(seed);
  return shuffleDeck(createDeck(rng), rng);
};
const fingerprint = (deck) =>
  deck.map((c) => `${c.id}:${c.rank}${c.suit}`).join(",");

console.log("Seeded shuffle");

const a = dealWith(12345);
const b = dealWith(12345);
const c = dealWith(999);

check(
  "same seed gives the same order and the same card ids",
  fingerprint(a) === fingerprint(b),
);
check(
  "a different seed gives a different order",
  fingerprint(a) !== fingerprint(c),
);

check("the deck is still 52 cards", a.length === 52, `got ${a.length}`);
check("every card id is unique", new Set(a.map((x) => x.id)).size === 52);
check(
  "every rank and suit combination appears once",
  new Set(a.map((x) => `${x.rank}${x.suit}`)).size === 52,
);

// Unseeded is what production runs. If this ever starts passing, the default
// stopped being random and every game deals the same cards.
const u1 = fingerprint(shuffleDeck(createDeck()));
const u2 = fingerprint(shuffleDeck(createDeck()));
check("without a seed the deck is still random", u1 !== u2);

console.log("Seed reaches machine context");

const seedOf = (input) =>
  createActor(gameMachine, { input }).getSnapshot().context.rng;

const m1 = seedOf({ gameId: "g1", seed: 42 });
const m2 = seedOf({ gameId: "g2", seed: 42 });
const m3 = seedOf({ gameId: "g3", seed: 43 });

const seq = (rng) => [rng.float(), rng.float(), rng.float()].join(",");
const s1 = seq(m1);

check("two games on the same seed draw the same sequence", s1 === seq(m2));
check("a different seed draws a different sequence", s1 !== seq(m3));
check(
  "an unseeded game gets the system source",
  seq(seedOf({ gameId: "g4" })) !== seq(seedOf({ gameId: "g5" })),
);

finish({
  passed: () => "\nAll seeded randomness checks passed.",
  failed: (failures) => `\n${failures} check(s) failed.`,
});
