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
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const CHECKPOINTS = ["lobby", "peek", "play", "drawn", "matching", "scoring"];

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
  shift: flag("shift"),
  sweep: flag("sweep"),
  matrix: flag("matrix"),
  counts: arg("counts", "2,4,6"),
  states: arg("states", "lobby,play,drawn,matching,scoring"),
  matrixStep: Number(arg("matrix-step", 40)),
  sweepWidths: arg("widths", "393,820,1440,1920"),
  sweepFrom: Number(arg("from", 360)),
  sweepTo: Number(arg("to", 1200)),
  sweepStep: Number(arg("step", 20)),
  theme: arg("theme", "dark"),
  // The observed player's name. Worth turning up deliberately: a seat's width
  // is set by its hand, so a long name truncates rather than widening the
  // seat, and how much it truncates is a thing to look at rather than assume.
  name: arg("name", "Observed"),
  out: arg("out", ".probe"),
  // A directory of shots from an earlier run. Every capture is compared
  // against its opposite number and the changed pixel count reported, so
  // "did this change anything it should not have" is answered rather than
  // hoped about.
  baseline: arg("baseline", null),
};

if (!["dark", "light"].includes(opts.theme)) {
  console.error(`--theme must be dark or light`);
  process.exit(2);
}

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
  await dialog.locator("input").first().fill(opts.name);
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

  /** One whole bot turn: draw, discard, clear whatever that opened. Returns
   *  false when this seat could not act, which is normal rather than fatal at
   *  six players (locked after check, disqualified on hand size, mid
   *  reshuffle, or the turn simply moved). */
  const playBotTurn = async (turn) => {
    // An ability can be waiting before this bot has drawn anything: a match on
    // a special card hands one to whoever made it, so a turn can open in
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
      return false;
    }
    turn.act("DISCARD_DRAWN_CARD");
    // A discarded King, Queen or Jack opens an ability instead of a matching
    // window, so the two have to be waited on together. Whichever the deck
    // deals is not something the driver gets to choose: CREATE_GAME takes no
    // seed, so every run gets a different deck.
    await turn
      .waitFor(
        (s) => !!s.matchingOpportunity || s.turnPhase === "ABILITY",
        "the matching window or an ability",
        8000,
      )
      .catch(() => {});
    await skipAnyAbility(turn);
    if (host.state?.matchingOpportunity) {
      for (const b of bots) b.act("PASS_ON_MATCH_ATTEMPT");
      await host
        .waitFor(
          (s) => !s.matchingOpportunity,
          "the matching window to close",
          8000,
        )
        .catch(() => {});
    }
    await skipAnyAbility(turn);
    return true;
  };

  /** Plays whole bot turns until the browser player is the one on the clock. */
  const passTurnToObserved = async () => {
    for (let guard = 0; guard < opts.players * 3; guard++) {
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
      await playBotTurn(turn);
    }
    throw new Error("could not hand the turn to the observed player");
  };

  if (opts.at === "play") {
    await passTurnToObserved();
    return { gameId, bots, observedId };
  }

  if (opts.at === "scoring") {
    // A bot calls it rather than the browser: CALL_CHECK goes straight down
    // the socket, where the button is a press-and-hold that would have to be
    // simulated. Then everyone takes their final turn and the round scores.
    const caller = bots.find((b) => b.id === host.state?.currentPlayerId);
    if (!caller) {
      await host.waitFor(
        (s) => bots.some((b) => b.id === s.currentPlayerId),
        "a bot to hold the turn so it can call check",
      );
    }
    (bots.find((b) => b.id === host.state?.currentPlayerId) ?? bots[0]).act(
      "CALL_CHECK",
    );
    await host.waitFor(
      (s) =>
        s.gameStage !== GameStage.PLAYING ||
        s.checkCalledBy ||
        Object.values(s.players).some((p) => p.hasCalledCheck),
      "check to be called",
    );

    // Final turns. Whoever is on the clock plays, browser included, until the
    // round scores.
    for (let guard = 0; guard < opts.players * 3; guard++) {
      if (
        host.state?.gameStage === "SCORING" ||
        host.state?.gameStage === "GAMEOVER"
      ) {
        break;
      }
      const turn = bots.find((b) => b.id === host.state?.currentPlayerId);
      if (turn) {
        await playBotTurn(turn);
        continue;
      }
      if (host.state?.currentPlayerId === observedId) {
        await page
          .getByRole("button", { name: /draw from deck/i })
          .click({ timeout: 8000 })
          .catch(() => {});
        await page
          .getByRole("button", { name: /discard card/i })
          .click({ timeout: 8000 })
          .catch(() => {});
      }
      await host
        .waitFor(
          (s) => s.currentPlayerId !== observedId,
          "the turn to move on",
          6000,
        )
        .catch(() => {});
    }
    await host.waitFor(
      (s) => s.gameStage === "SCORING" || s.gameStage === "GAMEOVER",
      "the round to score",
      30000,
    );
    // The sheet is deliberately held back ~1.1s so the last card flight can
    // land before it covers the table. Measuring before that catches the board
    // mid animation with no sheet on it.
    await page.waitForTimeout(1800);
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
    const bad = m.controls.filter(
      (c) => c.status !== "ok" && c.status !== "needs-scroll",
    );
    const scrolled = m.controls.filter((c) => c.status === "needs-scroll");
    const starved = m.starved ?? [];
    // A game view that scrolls at all is a failure, whether or not the scroll
    // makes anything unreachable. That is the whole of #82.
    const failed = bad.length > 0 || !!worst || starved.length > 0;
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

    for (const s of starved) {
      console.log(
        `  ${pad("", 14)}shows none of its ${s.items} items: a ${s.itemH}px item in a ${s.clientH}px frame (${s.cls})`,
      );
    }
    if (scrolled.length) {
      console.log(
        `  ${pad("", 14)}reachable only by scrolling: ${scrolled
          .map((c) => c.name)
          .join(", ")}`,
      );
    }
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

/** Does anything move sideways when only the game's phase changed?
 *
 *  Nothing in a seat should. Card positions are the game's spatial memory: a
 *  player is remembering "the nine is bottom-left", and a seat that drifts
 *  every time a status word changes length is quietly undermining that. */
const shiftCheck = async (page, host, observedId) => {
  const snap = () =>
    page.evaluate(() => {
      const out = [];
      for (const grid of document.querySelectorAll(".inline-grid")) {
        const seat = grid.closest(".flex.flex-col.items-center");
        const r = grid.getBoundingClientRect();
        const head = seat?.firstElementChild?.getBoundingClientRect();
        out.push({
          who: (seat?.innerText || "").split("\n")[0]?.slice(0, 16) ?? "?",
          handX: Math.round(r.x * 10) / 10,
          handW: Math.round(r.width * 10) / 10,
          headW: head ? Math.round(head.width * 10) / 10 : null,
          cards: [...grid.children].map(
            (c) => Math.round(c.getBoundingClientRect().x * 10) / 10,
          ),
        });
      }
      return out;
    });

  const label = () => {
    const s = host.state;
    return `${s?.turnPhase ?? "?"}${s?.currentPlayerId === observedId ? " (yours)" : ""}`;
  };

  const frames = [{ phase: label(), seats: await snap() }];
  const step = async (name, fn) => {
    await fn();
    await page.waitForTimeout(700); // let the layout spring settle
    frames.push({ phase: `${name} -> ${label()}`, seats: await snap() });
  };

  await step("draw", async () => {
    await page
      .getByRole("button", { name: /draw from deck/i })
      .click({ timeout: 8000 })
      .catch(() => {});
    await host
      .waitFor((s) => !!s.players[observedId]?.pendingDrawnCard, "drawn", 8000)
      .catch(() => {});
  });
  await step("discard", async () => {
    await page
      .getByRole("button", { name: /discard card/i })
      .click({ timeout: 8000 })
      .catch(() => {});
    await host
      .waitFor((s) => !!s.matchingOpportunity, "matching", 8000)
      .catch(() => {});
  });

  console.log(`\nsideways movement across phase changes\n${"-".repeat(72)}`);
  let moved = 0;
  const base = frames[0];
  for (const f of frames.slice(1)) {
    for (let i = 0; i < base.seats.length; i++) {
      const a = base.seats[i];
      const b = f.seats[i];
      if (!a || !b) continue;
      const dx = Math.round((b.handX - a.handX) * 10) / 10;
      const dw = Math.round((b.handW - a.handW) * 10) / 10;
      const dh = Math.round((b.headW - a.headW) * 10) / 10;
      if (Math.abs(dx) < 0.5 && Math.abs(dw) < 0.5) continue;
      moved++;
      console.log(
        `  ${f.phase.padEnd(28)} ${a.who.padEnd(12)} hand moved ${dx > 0 ? "+" : ""}${dx}px, width ${dw > 0 ? "+" : ""}${dw}px` +
          (Math.abs(dh) >= 0.5
            ? `  (its header changed ${dh > 0 ? "+" : ""}${dh}px)`
            : ""),
      );
    }
  }
  if (!moved) console.log("  nothing moved");
  console.log("");
  return moved;
};

/** Compares one capture against the same shot from an earlier run. Returns the
 *  share of pixels that differ, or null when there is nothing to compare to. */
const compareToBaseline = (shotPath, baselineDir, fileName, outDir) => {
  if (!baselineDir) return null;
  const prior = join(baselineDir, fileName);
  if (!existsSync(prior)) return null;
  const a = PNG.sync.read(readFileSync(prior));
  const b = PNG.sync.read(readFileSync(shotPath));
  if (a.width !== b.width || a.height !== b.height) return { resized: true };
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
  });
  const share = changed / (a.width * a.height);
  if (changed > 0) {
    writeFileSync(join(outDir, `diff-${fileName}`), PNG.sync.write(diff));
  }
  return { changed, share };
};

/** Walks every height in a range instead of sampling named devices.
 *
 *  A device list is a guess about where browser chrome leaves the viewport,
 *  and a wrong guess hides exactly the cliff it was meant to find: 1920x1080
 *  passed while the 1920x910 a real maximised Chrome gives was broken in
 *  production. Sweeping removes the guess. If every height fits, no device can
 *  land badly, whatever its chrome takes. */
const sweep = async (page, widths, from, to, step) => {
  const bad = [];
  let checked = 0;
  for (const width of widths) {
    let run = null;
    for (let height = from; height <= to; height += step) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(90);
      const m = await page.evaluate(measureInPage);
      checked++;
      const over = m.scrollers.reduce((n, s) => Math.max(n, s.overflowPx), 0);
      const unreachable = m.controls.filter(
        (c) => c.status !== "ok" && c.status !== "needs-scroll",
      ).length;
      if (over > 0 || unreachable > 0 || (m.starved?.length ?? 0) > 0) {
        if (run && run.width === width && run.to === height - step) {
          run.to = height;
          run.worst = Math.max(run.worst, over);
        } else {
          run = { width, from: height, to: height, worst: over };
          bad.push(run);
        }
      } else if (run && run.to !== height) {
        run = null;
      }
    }
  }

  console.log(
    `\nheight sweep ${from} to ${to} by ${step}, ${checked} viewports\n${"-".repeat(60)}`,
  );
  if (!bad.length) {
    console.log(`  fits at every height, at widths ${widths.join(", ")}`);
  } else {
    for (const b of bad) {
      console.log(
        `  FAIL width ${b.width}  heights ${b.from}${b.to !== b.from ? ` to ${b.to}` : ""}  worst ${b.worst}px over`,
      );
    }
  }
  console.log("");
  return bad;
};

/** Every combination that changes the board's height, swept.
 *
 *  Player count and game stage both change how tall the board is, and each
 *  had a failure the other could not see: a six player table did not fit a
 *  phone at all while two players fit everywhere, and two players turned out
 *  to be the worst case at low heights because it never triggers dense seats.
 *  Sweeping one and assuming the other is how both were missed.
 *
 *  Theme is deliberately not a dimension. The themes swap colour tokens and
 *  nothing else, so the geometry is identical and sweeping both would double
 *  the runtime for the same numbers. Theme is a screenshot question. */
const runMatrix = async (browser, counts, states, step) => {
  const rows = [];
  for (const players of counts) {
    for (const at of states) {
      const label = `${players}p ${at}`;
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1200 },
        deviceScaleFactor: 1,
      });
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {}
      }, opts.theme);
      const page = await context.newPage();
      let bots = [];
      try {
        process.stdout.write(`  building ${label} ... `);
        ({ bots } = await drive(page, { ...opts, at, players, seats: 6 }));
        const bad = await sweep(
          page,
          opts.sweepWidths.split(",").map(Number),
          opts.sweepFrom,
          opts.sweepTo,
          step,
          true,
        );
        rows.push({ label, bad });
        process.stdout.write(
          bad.length ? `${bad.length} failing band(s)\n` : "clean\n",
        );
      } catch (e) {
        rows.push({ label, error: e.message.split("\n")[0] });
        process.stdout.write(`could not build: ${e.message.split("\n")[0]}\n`);
      } finally {
        for (const b of bots) b.disconnect();
        await context.close();
      }
    }
  }

  console.log(`\n${"=".repeat(72)}\nmatrix result\n${"=".repeat(72)}`);
  let failures = 0;
  let worstFloor = 0;
  for (const r of rows) {
    if (r.error) {
      console.log(`  ${r.label.padEnd(14)} could not build: ${r.error}`);
      failures++;
      continue;
    }
    if (!r.bad.length) {
      console.log(`  ${r.label.padEnd(14)} fits at every height`);
      continue;
    }
    failures += r.bad.length;
    for (const b of r.bad) {
      worstFloor = Math.max(worstFloor, b.to);
      console.log(
        `  ${r.label.padEnd(14)} FAIL w${String(b.width).padEnd(5)} h${b.from}${b.to !== b.from ? `-${b.to}` : ""}  ${b.worst}px over`,
      );
    }
  }
  if (worstFloor) {
    console.log(
      `\n  Everything fits at every height above ${worstFloor}.` +
        `\n  Below that, see the bands above.`,
    );
  }
  console.log("");
  return failures;
};

const main = async () => {
  await preflight();
  const OUT = join(ROOT, opts.out);
  mkdirSync(OUT, { recursive: true });
  const shots = [];

  const browser = await chromium.launch({ headless: !opts.headed });

  if (opts.matrix) {
    const n = await runMatrix(
      browser,
      opts.counts.split(",").map(Number),
      opts.states.split(","),
      opts.matrixStep,
    );
    await browser.close();
    process.exit(n ? 1 : 0);
  }

  const viewports = resolveViewports(opts.viewports);
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
  // next-themes reads its choice from localStorage before paint, so it has to
  // be there before the first navigation or the run silently shoots whichever
  // theme happens to be the default.
  await context.addInitScript((theme) => {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, opts.theme);
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

    if (opts.sweep) {
      failures += (
        await sweep(
          page,
          opts.sweepWidths.split(",").map(Number),
          opts.sweepFrom,
          opts.sweepTo,
          opts.sweepStep,
        )
      ).length;
    }

    if (opts.shift) {
      await page.setViewportSize(viewports[0]);
      await page.waitForTimeout(300);
      failures += await shiftCheck(page, bots[0], observedId);
    }

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

      // Always, not only on failure. Capturing only failures leaves the run
      // visually blind exactly when everything passes, which is when a fix is
      // most likely to have quietly made something ugly rather than broken.
      const fileName = `${opts.at}-${opts.players}p${opts.seats}s-${opts.theme}-${viewport.name}.png`;
      const shotPath = join(OUT, fileName);
      await page.screenshot({ path: shotPath });
      shots.push({
        fileName,
        diff: compareToBaseline(shotPath, opts.baseline, fileName, OUT),
      });
    }

    const after = stamp();
    if (before !== after) {
      console.log(
        `\nWARNING: the game moved during the sweep (${before} -> ${after}).\n` +
          `Rows below may describe different boards. Raise TURN_TIMER_MS.`,
      );
    }

    failures = report(rows, opts);

    console.log(`${shots.length} shots (${opts.theme}) -> ${OUT}`);
    if (opts.baseline) {
      const compared = shots.filter((s) => s.diff);
      const moved = compared.filter((s) => s.diff.resized || s.diff.changed);
      if (!compared.length) {
        console.log(`  nothing in ${opts.baseline} to compare against`);
      } else if (!moved.length) {
        console.log(
          `  pixel identical to ${opts.baseline} (${compared.length} shots)`,
        );
      } else {
        console.log(`  changed against ${opts.baseline}:`);
        for (const s of moved) {
          console.log(
            s.diff.resized
              ? `    ${s.fileName}  different dimensions`
              : `    ${s.fileName}  ${(s.diff.share * 100).toFixed(2)}% of pixels (diff-${s.fileName})`,
          );
        }
      }
    }

    writeFileSync(
      join(OUT, "report.json"),
      JSON.stringify({ opts, rows, shots, consoleErrors }, null, 2),
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
