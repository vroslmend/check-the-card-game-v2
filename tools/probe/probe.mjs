// Layout and reachability probe.
//
//   node tools/probe/probe.mjs --at play --players 2 --seats 6
//
// One browser for the observed player, headless socket clients for the rest,
// then the viewport matrix swept against a single live game. The game is built
// once and every viewport re-measures it, which is why sweeping seven sizes
// costs about as much as measuring one.
//
// It reports measurements. Judgement is at the bottom, in one place.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HeadlessPlayer } from "./player.mjs";
import { resolve as resolveViewports } from "./viewports.mjs";
import { measureInPage } from "./measure.mjs";

const CLIENT = process.env.PROBE_CLIENT_URL ?? "http://localhost:3000";
const SERVER = process.env.PROBE_SERVER_URL ?? "http://localhost:8000";
// Anchored to the repo, not to the shell's directory, so output lands in the
// same place whether this is run from the root or from tools/probe.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, ".probe");

const CHECKPOINTS = ["lobby", "peek", "play", "drawn", "matching"];

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes(`--${name}`);

const opts = {
  at: arg("at", "play"),
  players: Number(arg("players", 2)),
  seats: Number(arg("seats", 2)),
  viewports: arg("viewports", "smoke"),
  headed: flag("headed"),
  verbose: flag("verbose"),
  breakdown: flag("breakdown"),
};

if (!CHECKPOINTS.includes(opts.at)) {
  console.error(
    `unknown checkpoint "${opts.at}"\nknown: ${CHECKPOINTS.join(", ")}`,
  );
  process.exit(2);
}
if (opts.players < 2 || opts.players > 6) {
  console.error("--players must be between 2 and 6");
  process.exit(2);
}
if (opts.seats < opts.players) opts.seats = opts.players;

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

const reachable = async (url) => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
};

const preflight = async () => {
  const problems = [];
  if (!(await reachable(`${SERVER}/health`))) {
    problems.push(`  server not answering at ${SERVER}/health`);
  }
  if (!(await reachable(CLIENT))) {
    problems.push(`  client not answering at ${CLIENT}`);
  }
  if (problems.length) {
    console.error(`\nNothing to probe.\n${problems.join("\n")}\n`);
    console.error("Start both with timers set for scripting:\n");
    console.error(
      "  PEEK_DURATION_MS=200 MATCHING_STAGE_DURATION_MS=400 TURN_TIMER_MS=600000 npm run dev\n",
    );
    console.error(
      "Those three are already environment variables, read at\n" +
        "server/src/game-machine.ts:43,46,75. Left at their defaults a scripted\n" +
        "round waits 10s for the peek alone.\n\n" +
        "The turn timer goes the other way, long rather than short. It is the\n" +
        "only one that fires without being asked, so a short one moves the board\n" +
        "out from under the sweep and rows stop describing the same game.\n",
    );
    process.exit(2);
  }
};

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const GameStage = {
  WAITING: "WAITING_FOR_PLAYERS",
  DEALING: "DEALING",
  INITIAL_PEEK: "INITIAL_PEEK",
  PLAYING: "PLAYING",
};

/** Declines whatever ability is on the stack, however many decision windows it
 *  wants. A King is peek-two then swap-one, so one skip is not always enough. */
const skipAnyAbility = async (player) => {
  for (let guard = 0; guard < 6; guard++) {
    if (player.state?.turnPhase !== "ABILITY") return;
    player.act("USE_ABILITY", { action: "skip" });
    await player
      .waitFor((s) => s.turnPhase !== "ABILITY", "the ability to clear", 3000)
      .catch(() => {}); // a multi-stage ability stays in ABILITY; loop again
  }
  if (player.state?.turnPhase === "ABILITY") {
    throw new Error("could not decline the ability after six attempts");
  }
};

/** Builds the game up to `at` and returns the browser page sitting in it. */
const drive = async (page, opts) => {
  const bots = [];
  const host = new HeadlessPlayer("Host");
  bots.push(host);
  const gameId = await host.createGame({ seats: opts.seats });

  // Everyone except the observed player. The observed player is the browser.
  for (let i = bots.length; i < opts.players - 1; i++) {
    const bot = new HeadlessPlayer(`Bot${i}`);
    await bot.joinGame(gameId);
    bots.push(bot);
  }

  // The browser joins the way a person does, through the dialog, so the join
  // path itself is covered rather than bypassed by seeding localStorage.
  await page.goto(`${CLIENT}/game/${gameId}`, {
    waitUntil: "domcontentloaded",
  });
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator("input").first().fill("Observed");
  await dialog.getByRole("button", { name: /confirm and join/i }).click();

  await host.waitFor(
    (s) => Object.keys(s.players ?? {}).length === opts.players,
    `${opts.players} players seated`,
  );

  if (opts.at === "lobby") return { gameId, bots };

  for (const bot of bots) bot.act("DECLARE_LOBBY_READY");
  await page
    .getByRole("button", { name: /^ready up$/i })
    .click({ timeout: 10000 });
  await host.waitFor(
    (s) => Object.values(s.players).every((p) => p.isReady),
    "everyone ready",
  );

  host.act("START_GAME");
  // Wait for INITIAL_PEEK itself, not merely for the lobby to end. DEALING
  // sits in between for 100ms and has no handler for the peek declaration, so
  // a declaration sent during it is dropped on the floor and the game waits
  // for a ready that already happened.
  await host.waitFor(
    (s) => s.gameStage === GameStage.INITIAL_PEEK,
    "the initial peek to open",
  );

  if (opts.at === "peek") return { gameId, bots, observedId: null };

  // Every player has to declare, including the browser: the only thing that
  // opens the window without them is the ready-stall timeout, which is the
  // turn timer, and that is deliberately long here so the board holds still
  // during the sweep.
  for (const bot of bots) bot.act("DECLARE_READY_FOR_PEEK");
  await page
    .getByRole("button", { name: /ready for peek/i })
    .click({ timeout: 15000 });
  await host.waitFor(
    (s) => s.gameStage === GameStage.PLAYING,
    "playing",
    30000,
  );

  // Whose seat is the browser holding? Needed because the action bar only
  // renders on your own turn, and measuring a board where someone else is
  // acting misses every control that matters.
  const observedId = await page.evaluate(() => {
    const raw = localStorage.getItem("playerSession");
    return raw ? JSON.parse(raw).playerId : null;
  });
  if (!observedId) throw new Error("browser player never got a session");

  /** Plays whole bot turns until the browser player is the one on the clock. */
  const passTurnToObserved = async () => {
    for (let guard = 0; guard < opts.players * 2; guard++) {
      if (host.state?.currentPlayerId === observedId) return;
      // Whose turn it is comes from one socket's view, not from each bot's own.
      // With six players the broadcasts land at slightly different moments and
      // asking every bot "is it me?" can pick one whose state has not caught up.
      const turn = bots.find((b) => b.id === host.state?.currentPlayerId);
      if (!turn) {
        await host.waitFor(
          (s) =>
            s.currentPlayerId === observedId ||
            bots.some((b) => b.id === s.currentPlayerId),
          "someone to hold the turn",
        );
        continue;
      }
      // An ability can be waiting before this bot has drawn anything: a match
      // on a special card hands one to whoever made it, so a turn can open in
      // ABILITY rather than DRAW, and DRAW_FROM_DECK is refused there.
      await skipAnyAbility(turn);
      turn.act("DRAW_FROM_DECK");
      try {
        await turn.waitFor(
          (s) => !!s.players[turn.id]?.pendingDrawnCard,
          "the bot's drawn card",
          6000,
        );
      } catch {
        // The turn moved, or this seat cannot draw right now: locked after
        // calling check, disqualified on hand size, or mid reshuffle. Re-read
        // who is on the clock and try again rather than insisting this bot
        // must be the one to act. Six players make these overlap often enough
        // that treating it as fatal only produces flaky runs.
        continue;
      }
      turn.act("DISCARD_DRAWN_CARD");
      // A discarded King, Queen or Jack opens an ability instead of a matching
      // window, so the two have to be waited on together. Whichever the deck
      // deals is not something the driver gets to choose: CREATE_GAME takes no
      // seed, so every run gets a different deck.
      await turn.waitFor(
        (s) => !!s.matchingOpportunity || s.turnPhase === "ABILITY",
        "the matching window or an ability",
      );
      await skipAnyAbility(turn);
      if (host.state?.matchingOpportunity) {
        for (const b of bots) b.act("PASS_ON_MATCH_ATTEMPT");
        await host.waitFor(
          (s) => !s.matchingOpportunity,
          "the matching window to close",
        );
      }
      await skipAnyAbility(turn);
    }
    throw new Error("could not hand the turn to the observed player");
  };

  if (opts.at === "play") {
    await passTurnToObserved();
    return { gameId, bots, observedId };
  }

  // The remaining checkpoints are about what the board looks like mid-turn, so
  // the observed player takes the turn rather than a bot.
  await passTurnToObserved();
  await page.getByRole("button", { name: /draw from deck/i }).click();
  await host.waitFor(
    (s) => !!s.players[observedId]?.pendingDrawnCard,
    "the observed player's drawn card",
  );

  if (opts.at === "drawn") return { gameId, bots, observedId };

  await page.getByRole("button", { name: /discard card/i }).click();
  await host.waitFor((s) => !!s.matchingOpportunity, "the matching window");
  return { gameId, bots, observedId };
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);

const report = (rows, opts) => {
  let failures = 0;
  console.log(
    `\n${pad("", 6)}${pad("viewport", 16)}${pad("frame", 7)}${pad("content", 9)}${pad("over", 6)}controls`,
  );
  console.log("-".repeat(80));

  for (const { viewport, m } of rows) {
    const worst = m.scrollers.sort((a, b) => b.overflowPx - a.overflowPx)[0];
    const bad = m.controls.filter((c) => c.status !== "ok");
    // A game view that scrolls at all is a failure, whether or not the scroll
    // makes anything unreachable. That is the whole of #82.
    const failed = bad.length > 0 || !!worst;
    if (failed) failures++;

    console.log(
      pad(failed ? "FAIL" : "ok", 6) +
        pad(viewport.name, 16) +
        pad(viewport.height, 7) +
        pad(worst ? worst.scrollH : "-", 9) +
        pad(worst ? `${worst.overflowPx} ${worst.mode}` : 0, 14) +
        (bad.length
          ? bad.map((c) => `${c.name} (${c.status})`).join(", ")
          : "all reachable"),
    );

    if (worst?.deepest) {
      const d = worst.deepest;
      console.log(
        `  ${pad("", 20)}furthest down: ${d.tag} ${d.cls} (${d.position}) reaches ${d.bottom} in a ${worst.clientH} frame`,
      );
    }
    for (const o of m.overlays) {
      if (o.uncoveredTop > 1 || o.uncoveredBottom > 1) {
        console.log(
          `  ${pad("", 14)}overlay "${o.name}" leaves ${o.uncoveredTop}px top / ${o.uncoveredBottom}px bottom uncovered`,
        );
      }
    }
    // Only when the scrollbar actually takes width. Headless Chromium uses
    // overlay scrollbars, so a 0px one here says nothing about a desktop
    // browser that reserves 15px for the same bar.
    if (worst?.isQueryContainer && worst.scrollbarPx > 0) {
      console.log(
        `  ${pad("", 20)}the scrolling element is also a container-query container: ` +
          `its ${worst.scrollbarPx}px scrollbar changes the width its own @md: rules resolve against`,
      );
    }
    if (m.docScrollsX) {
      console.log(`  ${pad("", 14)}the document scrolls horizontally`);
    }
    if (opts.breakdown && m.budget?.length) {
      const total = m.budget.reduce((n, b) => n + b.height, 0);
      console.log(`  ${pad("", 6)}where the ${total}px goes:`);
      for (const b of m.budget) {
        console.log(
          `  ${pad("", 6)}${String(b.height).padStart(5)}px  ${b.tag} ${b.cls}`,
        );
      }
    }
  }

  console.log("");
  if (opts.verbose) console.log(JSON.stringify(rows, null, 2));
  return failures;
};

// ---------------------------------------------------------------------------

const main = async () => {
  await preflight();
  mkdirSync(OUT, { recursive: true });

  const viewports = resolveViewports(opts.viewports);
  const browser = await chromium.launch({ headless: !opts.headed });
  // A fresh context every run: identity lives in localStorage as
  // `playerSession`, and a stale one makes the client try to rejoin a game the
  // server no longer has.
  // The game is built at a size nothing can be unreachable at, then the matrix
  // is swept. Driving at a matrix size would let the bug under test block the
  // driver: a probe that cannot click Ready because Ready is off screen reports
  // a crash instead of a finding.
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  let bots = [];
  let failures = 0;
  try {
    console.log(
      `building: ${opts.players} players, ${opts.seats} seats, stopping at "${opts.at}"`,
    );
    let observedId;
    ({ bots, observedId } = await drive(page, opts));

    // Every row has to describe the same game, or the table is comparing
    // different boards and quietly says nothing.
    const stamp = () => {
      const s = bots[0].state;
      return `${s?.gameStage}/${s?.turnPhase}/${s?.currentPlayerId}`;
    };
    const before = stamp();

    const rows = [];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      // One frame for the container queries and any layout animation to settle
      // before measuring, otherwise the first row reads mid-transition.
      await page.waitForTimeout(250);
      const m = await page.evaluate(measureInPage);
      rows.push({ viewport, m });

      const unreachable = m.controls.some((c) => c.status !== "ok");
      if (unreachable || m.scrollers.length) {
        await page.screenshot({
          path: join(OUT, `${opts.at}-${viewport.name}.png`),
        });
      }
    }

    const after = stamp();
    if (before !== after) {
      console.log(
        `\nWARNING: the game moved during the sweep (${before} -> ${after}).\n` +
          `Rows below may describe different boards. Raise TURN_TIMER_MS.`,
      );
    }

    failures = report(rows, opts);
    writeFileSync(
      join(OUT, "report.json"),
      JSON.stringify({ opts, rows, consoleErrors }, null, 2),
    );
    console.log(`detail -> ${join(OUT, "report.json")}`);

    if (consoleErrors.length) {
      failures++;
      console.log(`\n${consoleErrors.length} console error(s):`);
      for (const e of consoleErrors.slice(0, 5)) console.log(`  ${e}`);
    }
  } finally {
    for (const bot of bots) bot.disconnect();
    await browser.close();
  }

  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  if (
    e.code === "ERR_MODULE_NOT_FOUND" ||
    /playwright/i.test(e.message ?? "")
  ) {
    console.error(
      "\nThe probe's own dependencies are not installed. They live outside the\n" +
        "root workspaces on purpose, so that Vercel and Render never install a\n" +
        "browser they have no use for.\n\n  npm run probe:install\n",
    );
    process.exit(2);
  }
  console.error(`\nprobe failed: ${e.message}\n`);
  process.exit(2);
});
