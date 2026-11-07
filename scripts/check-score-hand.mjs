// Guards the card values in section 4 of docs/GAME_RULES.md, which decide who wins
// a round. The expected totals are worked out by hand from that section, so a wrong
// value in the table cannot pass by agreeing with itself.
//
// Run from the repo root, after npm run build:server-deps.

import { createReport } from "./lib/report.mjs";

const { scoreHand } = await import("../server/dist/lib/deck-utils.js");

const { check, finish } = createReport();
const hand = (...ranks) =>
  ranks.map((rank) => (rank ? { id: rank, suit: "S", rank } : null));

const CASES = [
  ["an ace is minus one", ["A"], -1],
  ["number cards are worth their face", ["2", "3", "4", "5"], 14],
  ["higher number cards too", ["6", "7", "8", "9"], 30],
  ["a ten is ten", ["T"], 10],
  ["a jack is eleven", ["J"], 11],
  ["a queen is twelve", ["Q"], 12],
  ["a king is thirteen", ["K"], 13],
  ["aces take a total below zero", ["A", "A", "A", "A"], -4],
  ["an empty slot scores nothing", ["K", null, "A", null], 12],
  ["a hand of empty slots scores nothing", [null, null], 0],
  ["no hand at all scores nothing", [], 0],
];

for (const [name, ranks, want] of CASES) {
  const got = scoreHand(hand(...ranks));
  check(name, got === want, `got ${got}, want ${want}`);
}

finish({
  passed: (n) => `Hands score by the rules (${n} checks).`,
  failed: (n) => `${n} check(s) failed.`,
});
