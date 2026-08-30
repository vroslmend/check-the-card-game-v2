// Guards the trust boundary between a socket message and the state machine.
//
// Guards inside the machine destructure event payloads directly, for example
// canAttemptMatch reads `payload: { handCardIndex }`. An action that arrives
// without a payload therefore throws mid-transition, and XState turns a throw
// in a guard into an actor error, which stops the machine. One malformed
// message from any player used to end the game for everyone: no timer fires,
// no turn advances, and no broadcast is ever emitted again.
//
// The trap is that the damage is silent and total. A stopped actor still
// answers getSnapshot, so the game keeps looking alive from the outside and
// rejoins keep succeeding, while nothing can ever move.
//
// Liveness here is deliberately not "did a packet arrive": a refused action is
// answered, so packets arrive either way. It is "did the game leave the
// matching stage on its own timer", which only a running machine can do.
//
// Drives the real compiled server over real sockets.
//
// Run from the repo root, after npm run build:server-deps.

process.env.NODE_ENV = "production";
process.env.PORT = "8213";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.PEEK_DURATION_MS = "150";
process.env.MATCHING_STAGE_DURATION_MS = "1500";
process.env.TURN_TIMER_MS = "60000";

const { io: ioc } = await import("socket.io-client");
const { httpServer } = await import("../server/dist/index.js");

const URL = "http://127.0.0.1:8213";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const connect = () =>
  new Promise((res) => {
    const s = ioc(URL, {
      transports: ["websocket"],
      reconnection: false,
      extraHeaders: { Origin: "http://localhost:3000" },
    });
    s.on("connect", () => res(s));
  });

const A = await connect();
const B = await connect();
let last = null;
A.on("GAME_STATE_UPDATE", (gs) => (last = gs));

const made = await new Promise((r) =>
  A.emit("CREATE_GAME", { name: "A", maxPlayers: 2 }, r),
);
await new Promise((r) => B.emit("JOIN_GAME", made.gameId, { name: "B" }, r));
A.emit("PLAYER_ACTION", { type: "DECLARE_LOBBY_READY" });
B.emit("PLAYER_ACTION", { type: "DECLARE_LOBBY_READY" });
await sleep(250);
A.emit("PLAYER_ACTION", { type: "START_GAME" });
await sleep(400);
A.emit("PLAYER_ACTION", { type: "DECLARE_READY_FOR_PEEK" });
B.emit("PLAYER_ACTION", { type: "DECLARE_READY_FOR_PEEK" });

// Reach a matching window, which is where the reachable crash lives.
for (let i = 0; i < 80; i++) {
  await sleep(150);
  if (!last) continue;
  if (last.turnPhase === "MATCHING") break;
  const sock = last.currentPlayerId === made.playerId ? A : B;
  if (last.turnPhase === "DRAW")
    sock.emit("PLAYER_ACTION", { type: "DRAW_FROM_DECK" });
  else if (last.turnPhase === "DISCARD")
    sock.emit("PLAYER_ACTION", { type: "DISCARD_DRAWN_CARD" });
}

console.log("\nA malformed action must not take the game with it:");
check(
  "a matching window was reached",
  last?.turnPhase === "MATCHING",
  `phase is ${last?.turnPhase}`,
);

// Every shape that used to throw inside a guard.
for (const payload of [undefined, null, "nonsense", 7]) {
  B.emit("PLAYER_ACTION", { type: "ATTEMPT_MATCH", payload });
  A.emit("PLAYER_ACTION", { type: "USE_ABILITY", payload });
  A.emit("PLAYER_ACTION", { type: "SWAP_AND_DISCARD", payload });
  A.emit("PLAYER_ACTION", { type: "REMOVE_PLAYER", payload });
}
await sleep(150);

// Only a running machine leaves the matching stage on its own timer.
const phaseBefore = last?.turnPhase;
await sleep(Number(process.env.MATCHING_STAGE_DURATION_MS) + 2500);
check(
  "the game kept running afterwards",
  last?.turnPhase !== "MATCHING",
  `${phaseBefore} -> ${last?.turnPhase}`,
);

// And it is still a real game, not a corpse that merely answers. A completed
// turn is the signal: the discard pile only grows when play actually happens.
// Comparing whole states would not do, because serverNow changes every
// broadcast and would pass on any packet at all.
const pileAtStart = last?.discardPileSize ?? 0;
for (let i = 0; i < 120; i++) {
  await sleep(150);
  if (!last) continue;
  if ((last.discardPileSize ?? 0) > pileAtStart) break;
  const sock = last.currentPlayerId === made.playerId ? A : B;
  if (last.turnPhase === "DRAW")
    sock.emit("PLAYER_ACTION", { type: "DRAW_FROM_DECK" });
  else if (last.turnPhase === "DISCARD")
    sock.emit("PLAYER_ACTION", { type: "DISCARD_DRAWN_CARD" });
  else if (last.turnPhase === "MATCHING") {
    A.emit("PLAYER_ACTION", { type: "PASS_ON_MATCH_ATTEMPT" });
    B.emit("PLAYER_ACTION", { type: "PASS_ON_MATCH_ATTEMPT" });
  } else if (last.turnPhase === "ABILITY") {
    const owner = last.abilityStack?.at(-1)?.playerId;
    const os = owner === made.playerId ? A : B;
    os.emit("PLAYER_ACTION", {
      type: "USE_ABILITY",
      payload: { action: "skip" },
    });
  }
}
check(
  "play can continue",
  (last?.discardPileSize ?? 0) > pileAtStart,
  `discard pile ${pileAtStart} -> ${last?.discardPileSize}`,
);

A.close();
B.close();
httpServer.close();

if (failures > 0) {
  console.error(`
${failures} malformed-payload failure${failures === 1 ? "" : "s"}.

A message from one player must never be able to stop the machine. If it can,
the game dies for everyone at once, with no timer left to recover it and
nothing on any screen to explain it. Treat a failure here as the server being
wrong rather than this script.`);
  process.exit(1);
}

console.log("\nA malformed message is rejected, not fatal.");
process.exit(0);
