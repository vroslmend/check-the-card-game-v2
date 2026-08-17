// Guards the positions a player is playing against. A hand is a two row grid,
// C = ceil(slots / 2) columns, filled row-major, and those positions are the
// memory the game is played on. docs/GAME_RULES.md says a penalty fills the
// earliest empty slot or adds a new one, that cards never change rows, and that
// a column collapse is the only time the grid rearranges itself.
//
// The trap is that C is derived from the slot count, so growing a hand by one
// can change C, and a new C silently re-wraps every index onto a different cell.
// That moves cards nobody touched, including the two the initial peek is a
// player's only look at.
//
// Enumerates every arrangement of cards and gaps from one slot to eight rather
// than a few worked examples, and takes penalties on each until the hand reaches
// the disqualification limit, asserting after every one that no card already
// held has changed cell.
//
// Exercises the real compiled placePenaltyCard, not a reimplementation.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";

const { placePenaltyCard } = await import("../server/dist/game-machine.js");

const MAX_HAND_SIZE = 8;

// Where index i renders, given a hand of s slots. This mirrors HandGrid, which
// derives its column count the same way.
const cellOf = (i, s) => {
  const c = Math.max(1, Math.ceil(s / 2));
  return i < c ? `r0c${i}` : `r1c${i - c}`;
};

const positions = (hand) => {
  const map = new Map();
  hand.forEach((card, i) => {
    if (card) map.set(card.id, cellOf(i, hand.length));
  });
  return map;
};

const cardsIn = (hand) => hand.filter(Boolean).length;

let failures = 0;
let placements = 0;
const fail = (message) => {
  if (failures < 10) console.error(`  FAIL  ${message}`);
  failures++;
};

const render = (hand) =>
  hand.map((c) => (c ? c.id : ".")).join(",") || "(empty)";

// One penalty onto one hand, checking everything that must hold afterwards.
const place = (hand, label, nextId) => {
  const before = positions(hand);
  const beforeCards = cardsIn(hand);
  const penalty = { id: nextId, rank: "5", suit: "S" };

  const { hand: after, index } = placePenaltyCard(hand, penalty);
  placements++;

  for (const [id, cell] of before) {
    const i = after.findIndex((c) => c && c.id === id);
    if (i < 0) {
      fail(
        `${label}: card ${id} disappeared, ${render(hand)} to ${render(after)}`,
      );
      continue;
    }
    const now = cellOf(i, after.length);
    if (now !== cell) {
      fail(
        `${label}: card ${id} moved ${cell} to ${now}, ${render(hand)} to ${render(after)}`,
      );
    }
  }

  if (cardsIn(after) !== beforeCards + 1) {
    fail(`${label}: card count went ${beforeCards} to ${cardsIn(after)}`);
  }
  if (after[index]?.id !== penalty.id) {
    fail(
      `${label}: reported index ${index} does not hold the penalty, ${render(after)}`,
    );
  }
  if (before.has(penalty.id)) {
    fail(`${label}: penalty landed on an occupied cell`);
  }

  return after;
};

// Every arrangement of cards and gaps from one slot to eight, which is a strict
// superset of what play can actually produce.
let shapes = 0;
for (let slots = 1; slots <= MAX_HAND_SIZE; slots++) {
  for (let mask = 0; mask < 1 << slots; mask++) {
    let hand = [];
    for (let i = 0; i < slots; i++) {
      hand.push(mask & (1 << i) ? { id: `c${i}`, rank: "2", suit: "H" } : null);
    }
    if (cardsIn(hand) === 0) continue;
    shapes++;

    const label = `${render(hand)}`;
    let n = 0;
    while (cardsIn(hand) < MAX_HAND_SIZE) {
      hand = place(hand, label, `p${n++}`);
    }
  }
}

console.log(`  ${shapes} starting shapes, ${placements} penalties placed`);

// The fill order decided for the issue: a new column takes its top cell, and the
// next penalty fills the bottom of that same column rather than growing again.
{
  const full = ["a", "b", "c", "d"].map((id) => ({ id, rank: "2", suit: "H" }));
  const one = placePenaltyCard(full, { id: "P", rank: "5", suit: "S" }).hand;
  const two = placePenaltyCard(one, { id: "Q", rank: "5", suit: "S" }).hand;
  const shown = (h) => h.map((c) => (c ? c.id : ".")).join("");

  if (shown(one) !== "abPcd.") {
    fail(`full hand plus one should be abPcd. , got ${shown(one)}`);
  }
  if (shown(two) !== "abPcdQ") {
    fail(`then plus one more should be abPcdQ , got ${shown(two)}`);
  }
}

// A hand that has shrunk renders an empty cell that is a hole in the rectangle
// rather than a null in the array. Without padding, the code cannot see it and
// grows a column it did not need.
{
  const three = ["a", "b", "c"].map((id) => ({ id, rank: "2", suit: "H" }));
  const grown = placePenaltyCard(three, { id: "P", rank: "5", suit: "S" }).hand;
  const shown = grown.map((c) => (c ? c.id : ".")).join("");
  if (shown !== "abcP") {
    fail(`three cards plus one should be abcP , got ${shown}`);
  }
}

if (failures > 0) {
  console.error(`
${failures} penalty placement failure${failures === 1 ? "" : "s"}.

placePenaltyCard in server/src/game-machine.ts decides where a penalty lands.
A card that changes cell is a card the player has to find again, so treat a
failure here as the game being wrong rather than this script, and check it
against The Hand Grid & Empty Slots in docs/GAME_RULES.md.`);
  process.exit(1);
}

console.log("Penalty cards land without moving a card already held.");
