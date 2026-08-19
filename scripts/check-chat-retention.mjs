// Guards what survives Play Again and what does not. The activity log describes
// a single round and is cleared with it. Chat is a conversation between the same
// people at the same table, so it carries across the whole session.
//
// The two live one line apart in resetForNewRound, which is how they came to be
// cleared together in the first place, and neither is visible in a single round:
// the bug only exists from the second round onward. That is why this runs rather
// than being played.
//
// Chat outliving the round makes it the one array that grows for the lobby's
// lifetime, so the retention cap is checked here too.
//
// Drives the real compiled gameMachine. Turns are not played by hand: the peek,
// matching and turn windows are shortened from the environment so the machine
// walks its own turns. server/.env.example documents every duration this reads.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PEEK_DURATION_MS = "80";
process.env.MATCHING_STAGE_DURATION_MS = "120";
process.env.TURN_TIMER_MS = "220";

const { gameMachine } = await import("../server/dist/game-machine.js");
const { createActor } = await import("xstate");

const P1 = "player-1";
const P2 = "player-2";
const RETENTION_CAP = 200;

const actor = createActor(gameMachine, { input: { gameId: "CHECK-CHAT" } });
actor.subscribe({ error: (err) => console.log("actor error:", err) });
actor.start();

const ctx = () => actor.getSnapshot().context;
const send = (e) => actor.send(e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitFor = async (predicate, what, ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (predicate(ctx())) return true;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${what} (stage=${ctx().gameStage})`);
};

let failures = 0;
let ran = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`);
  ran++;
  if (!ok) failures++;
};

const say = (playerId, name, message) =>
  send({
    type: "SEND_CHAT_MESSAGE",
    payload: { senderId: playerId, senderName: name, message },
  });

const said = () => ctx().chat.map((m) => m.message);

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

await waitFor((c) => c.gameStage === "PLAYING", "round 1 to start");
say(P1, "P1", "round one");
say(P2, "P2", "good luck");

check("chat holds what was said in round one", said().includes("round one"));
check("the log is not empty during a round", ctx().log.length > 0);

// One Check ends the round. The turn timer walks the final turns by itself.
send({ type: "CALL_CHECK", playerId: ctx().currentPlayerId ?? P1 });
await waitFor(
  (c) => c.gameStage === "SCORING" || c.gameStage === "GAMEOVER",
  "round 1 to score",
);

// SCORING holds for a few seconds so the sheet can be read, and PLAY_AGAIN
// before that is ignored rather than refused, so waiting is not optional.
await waitFor((c) => c.gameStage === "GAMEOVER", "the end screen to settle");
const epochBefore = ctx().roundEpoch;
const roundOneLogIds = new Set(ctx().log.map((e) => e.id));
const host = ctx().gameMasterId ?? P1;
send({ type: "PLAY_AGAIN", playerId: host });
await waitFor((c) => c.roundEpoch > epochBefore, "the round to reset");

check(
  "chat survives Play Again",
  said().includes("round one") && said().includes("good luck"),
  JSON.stringify(said()),
);
// Not an emptiness check: the new round writes its own first entries before
// this line runs. What has to be true is that none of round one's survive.
check(
  "the round's log does not survive Play Again",
  ctx().log.every((e) => !roundOneLogIds.has(e.id)),
  `carried=${ctx().log.filter((e) => roundOneLogIds.has(e.id)).length}`,
);

send({ type: "DECLARE_LOBBY_READY", playerId: P1 });
send({ type: "DECLARE_LOBBY_READY", playerId: P2 });
send({ type: "START_GAME", playerId: host });
await waitFor((c) => c.gameStage === "PLAYING", "round 2 to start");

say(P2, "P2", "round two");
check(
  "round two chat lands on top of round one",
  said().join("|") === "round one|good luck|round two",
  JSON.stringify(said()),
);

// A conversation that outlives every round has to stop somewhere.
for (let i = 0; i < RETENTION_CAP + 20; i++) say(P1, "P1", `filler ${i}`);
const chat = ctx().chat;
check(
  "retention is capped",
  chat.length === RETENTION_CAP,
  `length=${chat.length} cap=${RETENTION_CAP}`,
);
check(
  "the cap drops the oldest, not the newest",
  chat.at(-1).message === `filler ${RETENTION_CAP + 19}` &&
    !said().includes("round one"),
  `newest=${chat.at(-1).message}`,
);
check(
  "every retained message keeps a unique id",
  new Set(chat.map((m) => m.id)).size === chat.length,
);

actor.stop();

if (failures > 0) {
  console.error(`
${failures} chat retention check${failures === 1 ? "" : "s"} failed.

resetForNewRound in server/src/game-machine.ts clears the round's log. It must
not clear context.chat, and the client half must merge chat across the roundEpoch
bump rather than replacing it (client/machines/uiMachine.ts). Both halves are
needed: the server keeping chat is invisible if the client drops its own copy.`);
  process.exit(1);
}

console.log(`Chat survives the round, the log does not (${ran} checks).`);
