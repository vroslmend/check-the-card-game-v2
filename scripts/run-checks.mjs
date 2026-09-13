// Runs every game check under node --test, each in its own process, and reports
// every failure rather than stopping at the first. The checks import the
// compiled server, so run npm run build:server-deps first.

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptsDir);

// These two check the repository rather than the game and run as their own
// steps in verify.
const REPO_CHECKS = new Set([
  "check-commit-style.mjs",
  "check-dependency-majors.mjs",
]);

const checks = readdirSync(scriptsDir)
  .filter((name) => /^check-.+\.mjs$/.test(name) && !REPO_CHECKS.has(name))
  .sort()
  .map((name) => join("scripts", name));

// node --test passes when it is given nothing to run.
if (checks.length === 0) {
  console.error("No game checks found in scripts/.");
  process.exit(1);
}

// A timeout inside node --test does not stop a script that never exits.
const DEADLINE_MS = 5 * 60 * 1000;

const child = spawn(
  process.execPath,
  [
    "--test",
    // Without a terminal, Node 22 defaults to TAP, which reads nothing like a
    // local run.
    "--test-reporter=spec",
    `--test-concurrency=${process.env.CHECK_CONCURRENCY ?? "4"}`,
    ...checks,
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

const deadline = setTimeout(() => {
  console.error(
    `\nThe game checks did not finish within ${DEADLINE_MS / 60_000} minutes.`,
  );
  child.kill();
  process.exit(1);
}, DEADLINE_MS);

child.on("exit", (code) => {
  clearTimeout(deadline);
  process.exit(code ?? 1);
});
