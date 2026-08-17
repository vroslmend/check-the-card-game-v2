import { execFileSync } from "node:child_process";

// Commit messages are the one thing here that cannot be fixed after the fact.
// Everything else can be changed in a follow up, but a trailer or a byline is
// part of published history the moment it merges, and rewriting main is the
// only way to take one back. So this runs before the merge rather than after.
//
// Checks the commits this branch adds, never the ones it is based on, so an
// older message that predates the check does not fail every branch that comes
// after it.

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

const resolves = (ref) => {
  try {
    git("rev-parse", "--verify", `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

// A shallow checkout has no base to compare against. That is a CI configuration
// problem rather than a style failure, so say so and pass.
const base = ["origin/main", "main"].find(resolves);
if (!base) {
  console.log(
    "Commit style not checked: no main to compare against in this checkout.",
  );
  process.exit(0);
}

const range = `${base}..HEAD`;
const shas = git("rev-list", range).split("\n").filter(Boolean);

const RULES = [
  {
    name: "an em dash",
    test: (message) => message.includes("—"),
  },
  {
    name: "a co-author trailer",
    test: (message) => /^\s*co-authored-by:/im.test(message),
  },
  {
    name: "a generated-by line",
    test: (message) => /generated\s+with|generated\s+by/i.test(message),
  },
];

const problems = [];
let checked = 0;

for (const sha of shas) {
  // Merge commits carry a message this repo did not write, and bots write their
  // own. Neither is something a contributor can reword. On a pull request the
  // range also holds the merge commit Actions builds, so skipping them is what
  // keeps the count below honest about how many were actually read.
  const parents = git("rev-list", "--parents", "-n", "1", sha).split(" ");
  if (parents.length > 2) continue;
  if (/\[bot\]/.test(git("show", "-s", "--format=%an", sha))) continue;
  checked++;

  const message = git("show", "-s", "--format=%B", sha);
  const subject = git("show", "-s", "--format=%s", sha);
  for (const rule of RULES) {
    if (rule.test(message)) {
      problems.push(`  ${sha.slice(0, 8)}  ${rule.name}  ${subject}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`These commit messages need rewording before they merge:\n`);
  for (const p of problems) console.error(p);
  console.error(`
Reword them and force push the branch:

  git rebase -i ${base}`);
  process.exit(1);
}

console.log(
  `Commit style clean (${checked} commit${checked === 1 ? "" : "s"} checked in ${range}).`,
);
