// Rules from docs/GAME_RULES.md that must hold after every event of every round.
// Feed observe() each snapshot's context, in order, and it returns what broke.
// It keeps a little state, for the rules about whose turn comes next, so one
// table needs its own instance.

export const RULES = {
  cards: "52 cards, each in one place",
  handSize: "no hand above eight cards",
  eightDisqualifies: "a hand of eight is disqualified",
  hidden: "a hidden card's face reaches no client",
  lockedSkipped: "a locked player takes no turn",
  turnOrder: "the turn passes to the next unlocked seat",
  finalTurns: "one final turn for each player still unlocked",
  winner: "the lowest score that may win, wins",
};

const IN_PLAY = new Set(["PLAYING", "FINAL_TURNS"]);
const REVEALED = new Set(["SCORING", "GAMEOVER"]);

const walk = (value, visit) => {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (value && typeof value === "object") {
    visit(value);
    Object.values(value).forEach((item) => walk(item, visit));
  }
};

const heldCards = (player) => player.hand.filter(Boolean);

const nextUnlockedAfter = (c, playerId) => {
  const order = c.turnOrder;
  const at = order.indexOf(playerId);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(at + step) % order.length];
    if (!c.players[id].isLocked) return id;
  }
  return null;
};

export const createInvariants = (generatePlayerView) => {
  let epoch = null;
  let segment = null;
  let turnPlayer = null;
  let finalTurns = new Set();
  let scored = false;

  return {
    observe(c) {
      const broken = [];
      const fail = (rule, detail) => broken.push({ rule, detail });

      if (c.roundEpoch !== epoch) {
        epoch = c.roundEpoch;
        segment = null;
        turnPlayer = null;
        finalTurns = new Set();
        scored = false;
      }
      if (c.gameStage === "WAITING_FOR_PLAYERS") return broken;
      const players = Object.values(c.players);

      const cards = [...c.deck, ...c.discardPile];
      for (const p of players) {
        cards.push(...heldCards(p));
        if (p.pendingDrawnCard) cards.push(p.pendingDrawnCard.card);
      }
      const ids = new Set(cards.map((card) => card.id));
      if (cards.length !== 52 || ids.size !== 52) {
        fail(RULES.cards, `${cards.length} cards, ${ids.size} ids`);
      }

      // Section 7.4.
      for (const p of players) {
        const held = heldCards(p).length;
        if (held > 8) fail(RULES.handSize, `${p.id} holds ${held}`);
        if (held === 8 && p.status !== "DISQUALIFIED") {
          fail(RULES.eightDisqualifies, `${p.id} is ${p.status}`);
        }
      }

      // Walks the whole view rather than the fields known to carry cards, so a
      // field added later is covered too. Peeks travel in their own socket events.
      if (!REVEALED.has(c.gameStage)) {
        const hidden = new Set(c.deck.map((card) => card.id));
        for (const p of players)
          heldCards(p).forEach((card) => hidden.add(card.id));
        for (const viewer of Object.keys(c.players)) {
          const notTheirs = new Set(hidden);
          for (const p of players) {
            if (p.id !== viewer && p.pendingDrawnCard?.source === "deck") {
              notTheirs.add(p.pendingDrawnCard.card.id);
            }
          }
          walk(generatePlayerView({ context: c }, viewer), (o) => {
            if (notTheirs.has(o.id) && ("rank" in o || "suit" in o)) {
              fail(RULES.hidden, `${viewer} sees ${o.id}`);
            }
          });
        }
      }

      // Sections 9.C and 9.D, in both phases.
      if (IN_PLAY.has(c.gameStage) && c.currentTurnSegment === "DRAW") {
        const id = c.currentPlayerId;
        if (segment !== "DRAW" || id !== turnPlayer) {
          if (!c.players[id] || c.players[id].isLocked) {
            fail(RULES.lockedSkipped, `${id} has the turn`);
          }
          const expected = turnPlayer && nextUnlockedAfter(c, turnPlayer);
          if (expected && expected !== id) {
            fail(RULES.turnOrder, `${turnPlayer} to ${id}, not ${expected}`);
          }
          if (c.gameStage === "FINAL_TURNS") {
            if (finalTurns.has(id)) fail(RULES.finalTurns, `${id} again`);
            finalTurns.add(id);
          }
          turnPlayer = id;
        }
      }
      segment = IN_PLAY.has(c.gameStage) ? c.currentTurnSegment : null;

      if (c.gameover && !scored) {
        scored = true;
        // Section 9.C. A disqualified player is locked, so drops out here.
        if (c.checkDetails) {
          const missed = players.filter(
            (p) => !p.isLocked && !finalTurns.has(p.id),
          );
          if (missed.length)
            fail(RULES.finalTurns, `${missed.map((p) => p.id)} had none`);
        }
        // Sections 10.3 and 7.4.
        const { playerScores, winnerIds } = c.gameover;
        const eligible = players.filter(
          (p) => !p.forfeited && p.status !== "DISQUALIFIED",
        );
        const low = Math.min(...eligible.map((p) => playerScores[p.id]));
        const want = eligible
          .filter((p) => playerScores[p.id] === low)
          .map((p) => p.id);
        const got = [...winnerIds];
        if (!got.length || want.sort().join() !== got.sort().join()) {
          fail(RULES.winner, `winners ${got} but ${want} scored ${low}`);
        }
      }

      return broken;
    },
  };
};
