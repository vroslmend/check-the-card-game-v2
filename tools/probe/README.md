# Layout probe

Answers one question across every screen size at once: does the game fit, and
can a player reach the controls.

```
npm run probe:install          # once
npm run probe -- --at play --players 2 --seats 6
```

```
      viewport        frame  content  over  controls
--------------------------------------------------------------------------------
FAIL  pixel5-nobar    801    820      19    all reachable
FAIL  pixel5-bar      745    820      75    Draw from Deck (clipped), Hold to Check! (clipped)
FAIL  iphone-se       667    781      114   Draw from Deck (offscreen), Hold to Check! (offscreen)
FAIL  laptop-short    500    742      242   Draw from Deck (offscreen), Hold to Check! (offscreen)
ok    desktop         1080   -        0     all reachable
```

## Running it

The client and server have to be up, with timers set for scripting:

```
PEEK_DURATION_MS=200 MATCHING_STAGE_DURATION_MS=400 TURN_TIMER_MS=600000 npm run dev
```

Two of those go short and one goes long. The peek and matching windows are
waits the driver has to sit through. The turn timer is the only one that fires
without being asked, so a short one moves the board out from under the sweep
and the rows stop describing the same game.

## Options

|               |                                                                                      |
| ------------- | ------------------------------------------------------------------------------------ |
| `--at`        | `lobby`, `peek`, `play`, `drawn`, `matching`. Default `play`.                        |
| `--players`   | How many actually join, 2 to 6. Default 2.                                           |
| `--seats`     | Lobby capacity. Defaults to `--players`. Six seats with two players is its own case. |
| `--viewports` | `smoke` (default), `all`, or a comma separated list.                                 |
| `--theme`     | `dark` (default) or `light`.                                                         |
| `--name`      | The observed player's name. Long ones are worth trying on purpose.                   |
| `--out`       | Where captures land. Default `.probe`.                                               |
| `--baseline`  | An earlier `--out` directory to compare this run's captures against.                 |
| `--shift`     | Change phase, then report anything that moved sideways.                              |
| `--breakdown` | Itemise where the height goes, row by row.                                           |
| `--headed`    | Watch it drive.                                                                      |
| `--verbose`   | Dump the raw measurements.                                                           |

Exit code is 1 when something fails and 2 when the probe could not run at all.

## Screenshots are taken always, not only on failure

This was the other way round once, and it made a run blind exactly when
everything passed, which is when a change is most likely to have quietly made
something ugly rather than broken. Green tells you nothing about whether a name
now truncates to three letters.

Every viewport is captured as `<at>-<players>p<seats>s-<theme>-<viewport>.png`,
so two runs of the same command produce comparable files. Point the second run
at the first:

```
npm run probe -- --at play --name "Ammar Hassan" --out .probe/before
# change something
npm run probe -- --at play --name "Ammar Hassan" --out .probe/after --baseline .probe/before
```

It reports the share of pixels that moved per shot and writes a `diff-*.png`
marking them, so "did this touch anything it should not have" is answered
rather than assumed.

`report.json` lands beside them.

## How it is put together

**One browser, headless clients for everyone else.** Only the observed player
needs a rendering engine. The rest are `socket.io-client` connections in
`player.mjs` that act the instant the server allows it, which is what makes a
scripted round take seconds. That module is deliberately an importable API
rather than a script, because #75 wants the same clients for wire level
assertions and two drivers would drift.

**The game is built once and every viewport re-measures it.** Sweeping seven
sizes costs about what measuring one costs.

**Driving happens at 1600x1200, not at a matrix size.** Otherwise the bug under
test blocks the driver, and a probe that cannot click Ready because Ready is off
screen reports a crash instead of a finding.

**Measurements, not opinions.** `measure.mjs` returns numbers and every
judgement is made in one place in `probe.mjs`, so a failure reads
`centre y=730 in a 745 frame` rather than an assertion that tells you nothing.

**Bound to `aria-label`, not classes**, so a Tailwind edit does not blind it.

## Known gaps

- No seed control. `CREATE_GAME` takes a name and `maxPlayers` and nothing
  else, so each run gets a different deck and the driver has to cope with
  whatever it deals, including a King turning a discard into an ability.
  Seeding is #36 step 1 and is already done in the machine; plumbing it through
  the socket payload would make runs repeatable.
- Not wired into CI. #57 wants its own job, separate from the fast typecheck
  workflow. Adding one is a follow up, not part of introducing the tool.
- Layout and reachability only. The stability probe, which catches things
  moving when nothing asked them to (#83), is the obvious next one.

## Why it lives outside the workspaces

`tools/probe` is not in the root `workspaces` array and has its own manifest, so
`npm ci` at the root never installs Playwright or downloads a browser. Vercel
and Render build from that root install, and neither has any use for a
114MB browser.
