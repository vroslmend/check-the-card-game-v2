// Loads the compiled game machine and plays it the way a check needs to.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let loadedWith = null;

// The machine reads its timings from the environment once, when it is imported,
// and the logger picks its level the same way, so both have to be set before the
// import. A second load in the same process would get the cached modules and
// silently keep the first timings.
export const loadGame = async (timings = {}) => {
  const requested = JSON.stringify(timings);
  if (loadedWith !== null && loadedWith !== requested) {
    throw new Error(
      "loadGame was already called with different timings in this process.",
    );
  }
  loadedWith = requested;

  process.env.NODE_ENV = "production";
  for (const [name, value] of Object.entries(timings)) {
    process.env[name] = String(value);
  }

  const [{ gameMachine }, { generatePlayerView }, { createActor }] =
    await Promise.all([
      import("../../server/dist/game-machine.js"),
      import("../../server/dist/state-redactor.js"),
      import("xstate"),
    ]);

  // Wraps an actor that already exists, such as one resolved from a prepared
  // snapshot. The caller starts it.
  const tableFor = (actor, label = "") => {
    const errors = [];
    actor.subscribe({
      error: (error) => {
        errors.push(error);
        console.error(`${label}${label && ": "}actor error:`, error);
      },
    });

    const snapshot = () => actor.getSnapshot();
    const context = () => snapshot().context;
    const send = (event) => actor.send(event);

    const waitFor = async (predicate, what, timeoutMs = 20_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (predicate(context())) return;
        await sleep(10);
      }
      const c = context();
      throw new Error(
        `${label}${label && ": "}timed out waiting for ${what} (stage=${c.gameStage}, current=${c.currentPlayerId})`,
      );
    };

    const readyLobby = () => {
      for (const playerId of Object.keys(context().players)) {
        send({ type: "DECLARE_LOBBY_READY", playerId });
      }
    };

    const playThroughPeek = async () => {
      await waitFor((c) => c.gameStage === "INITIAL_PEEK", "initial peek");
      for (const playerId of context().turnOrder) {
        send({ type: "DECLARE_READY_FOR_PEEK", playerId });
      }
      await waitFor(
        (c) => c.gameStage === "PLAYING" && c.currentTurnSegment === "DRAW",
        "the first turn",
      );
    };

    const startRound = async (hostId) => {
      send({ type: "START_GAME", playerId: hostId });
      await playThroughPeek();
    };

    // The plainest legal move for whoever has to act: draw from the deck,
    // discard what was drawn, pass on every match and skip every ability.
    const step = () => {
      const c = context();
      if (c.gameStage !== "PLAYING" && c.gameStage !== "FINAL_TURNS") return;
      if (c.currentTurnSegment === "DRAW" && c.currentPlayerId) {
        send({ type: "DRAW_FROM_DECK", playerId: c.currentPlayerId });
      } else if (c.currentTurnSegment === "DISCARD" && c.currentPlayerId) {
        send({ type: "DISCARD_DRAWN_CARD", playerId: c.currentPlayerId });
      } else if (c.currentTurnSegment === "MATCHING") {
        for (const playerId of c.matchingOpportunity?.remainingPlayerIDs ??
          []) {
          send({ type: "PASS_ON_MATCH_ATTEMPT", playerId });
        }
      } else if (c.currentTurnSegment === "ABILITY") {
        const ability = c.abilityStack.at(-1);
        if (ability) {
          send({
            type: "USE_ABILITY",
            playerId: ability.playerId,
            payload: { action: "skip" },
          });
        }
      }
    };

    const callCheck = () =>
      send({ type: "CALL_CHECK", playerId: context().currentPlayerId });

    // Plays until SCORING (or past it) or until GAMEOVER. onScoring runs once,
    // as soon as SCORING is entered, before any other move.
    const playUntil = async (stage, { onScoring } = {}) => {
      const reached = (c) =>
        stage === "SCORING"
          ? c.gameStage === "SCORING" || c.gameStage === "GAMEOVER"
          : c.gameStage === stage;
      let scoringSeen = false;
      const deadline = Date.now() + 30_000;
      while (!reached(context()) && Date.now() < deadline) {
        if (context().gameStage === "SCORING" && !scoringSeen) {
          scoringSeen = true;
          onScoring?.();
        } else {
          step();
        }
        await sleep(10);
      }
      await waitFor(reached, stage);
    };

    return {
      actor,
      errors,
      snapshot,
      context,
      send,
      waitFor,
      readyLobby,
      playThroughPeek,
      startRound,
      step,
      callCheck,
      playUntil,
      stop: () => actor.stop(),
    };
  };

  // A started game with every player seated in the lobby, in order.
  const openTable = ({ gameId, seed, players, label = "" }) => {
    const table = tableFor(
      createActor(gameMachine, { input: { gameId, seed } }),
      label,
    );
    table.actor.start();
    players.forEach((playerId, index) =>
      table.send({
        type: "PLAYER_JOIN_REQUEST",
        playerSetupData: { name: `P${index + 1}`, socketId: `s-${playerId}` },
        playerId,
      }),
    );
    return table;
  };

  return { gameMachine, createActor, generatePlayerView, openTable, tableFor };
};
