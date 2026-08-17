// Guards the boundary that keeps hidden cards hidden: no face down card's rank
// or suit may reach any client outside SCORING and GAMEOVER, including the card's
// owner. docs/GAME_RULES.md defines what each player is allowed to know.
//
// This is worth a check of its own because when it breaks, nothing else notices.
// The game still builds, still type checks and still plays correctly. It is just
// pointless, because everyone can read the hand they are supposed to remember.
//
// Exercises the real compiled generatePlayerView, not a reimplementation.
//
// Run from the repo root, after npm run build:server-deps.

// Set before the import, because the logger picks its level at module load and
// the redactor logs every view it builds at debug.
process.env.NODE_ENV = "production";

const { generatePlayerView } = await import("../server/dist/state-redactor.js");

const card = (id, rank, suit) => ({ id, rank, suit });
const Ahand = [
  card("a0", "K", "S"),
  card("a1", "7", "H"),
  card("a2", "A", "D"),
  card("a3", "3", "C"),
];
const Bhand = [
  card("b0", "Q", "S"),
  card("b1", "2", "H"),
  card("b2", "9", "D"),
  card("b3", "J", "C"),
];

const player = (id, name, hand, pending) => ({
  id,
  name,
  hand,
  status: "PLAYING",
  isReady: true,
  isDealer: false,
  hasCalledCheck: false,
  isLocked: false,
  score: 0,
  isConnected: true,
  forfeited: false,
  pendingDrawnCard: pending,
});

const ctx = ({ stage = "PLAYING", aPending = null } = {}) => ({
  gameId: "g1",
  gameMasterId: "A",
  players: {
    A: player("A", "Alice", Ahand, aPending),
    B: player("B", "Bob", Bhand, null),
  },
  gameStage: stage,
  log: [],
  chat: [],
  deck: [card("d0", "5", "S")],
  discardPile: [card("x0", "4", "H")],
  lockedCardIds: [],
  turnOrder: ["A", "B"],
  currentPlayerId: "A",
  currentTurnSegment: null,
  abilityStack: [],
  matchingOpportunity: null,
  checkDetails: null,
  winnerId: null,
  gameover: false,
  lastRoundLoserId: null,
  rematchVotes: [],
  discardPileIsSealed: false,
  publicPeek: null,
  publicSwap: null,
  publicPenalty: null,
  turnDeadline: null,
  turnTimerMs: 45000,
  maxPlayers: 4,
});

const view = (opts, viewer) =>
  generatePlayerView({ context: ctx(opts) }, viewer);
const hasFace = (c) =>
  !!c && typeof c === "object" && "rank" in c && "suit" in c;
const isFacedown = (c) =>
  !!c && c.facedown === true && !("rank" in c) && !("suit" in c);

let failures = 0;
let ran = 0;
const check = (label, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${label}${detail && `  ${detail}`}`,
  );
  ran++;
  if (!passed) failures++;
};

// The one that matters. A player's own face down cards are the memory the whole
// game is played against, so leaking them to their owner is not a small leak.
{
  const own = view({}, "A").players.A.hand;
  const leaked = own.filter(hasFace);
  check(
    "own hand hidden from its owner while PLAYING",
    leaked.length === 0,
    leaked.length ? `leaked ${leaked.length} of ${own.length}` : "",
  );
  check(
    "own hand keeps its card ids, which the client needs",
    own.every((c) => c && typeof c.id === "string" && c.id.length > 0),
  );
}

{
  const opponent = view({}, "A").players.B.hand;
  check("opponent hand hidden while PLAYING", opponent.every(isFacedown));
}

// Both revealing stages, because the rule names both and testing only one would
// leave the other free to change.
for (const stage of ["SCORING", "GAMEOVER"]) {
  const seen = view({ stage }, "A");
  check(`own hand revealed at ${stage}`, seen.players.A.hand.every(hasFace));
  check(
    `opponent hand revealed at ${stage}`,
    seen.players.B.hand.every(hasFace),
  );
}

// A card drawn from the deck is legitimately the drawer's to look at, and just
// as legitimately hidden from everyone else. Redacting too much breaks the game
// as surely as redacting too little.
{
  const pending = { card: card("p0", "K", "H"), source: "deck" };
  check(
    "drawer sees the card they drew from the deck",
    hasFace(view({ aPending: pending }, "A").players.A.pendingDrawnCard.card),
  );
  check(
    "opponents cannot see a held deck draw",
    isFacedown(
      view({ aPending: pending }, "B").players.A.pendingDrawnCard.card,
    ),
  );
}

if (failures > 0) {
  console.error(`
${failures} hidden card check${failures === 1 ? "" : "s"} failed.

generatePlayerView in server/src/state-redactor.ts is the only thing standing
between a face down card and every connected client. Do not adjust this script
to match the code without deciding, against docs/GAME_RULES.md, which of the two
is wrong.`);
  process.exit(1);
}

console.log(`Hidden cards stay hidden (${ran} checks).`);
