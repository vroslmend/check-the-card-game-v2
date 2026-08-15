import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Dependabot's ignore rules do not apply to security updates, so a major can
// arrive as a security fix. #65 was next 15 to 16 wearing a sharp patch's
// clothes. Nothing else in CI would notice: a major that still compiles and
// still boots passes every other step.
//
// Dependabot edits manifests, never this file, so a major bump fails here
// until a person deliberately changes the number and says why.
const EXPECTED = {
  "client/package.json": {
    next: 15,
    react: 19,
    "react-dom": 19,
    xstate: 5,
    "@xstate/react": 5,
    "socket.io-client": 4,
    motion: 12,
  },
  "server/package.json": {
    "socket.io": 4,
    xstate: 5,
    immer: 10,
  },
};

const majorOf = (range) => {
  const match = /(\d+)\./.exec(String(range).replace(/^[^\d]*/, ""));
  return match ? Number(match[1]) : null;
};

const problems = [];

for (const [manifest, expected] of Object.entries(EXPECTED)) {
  const pkg = JSON.parse(readFileSync(join(root, manifest), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, wanted] of Object.entries(expected)) {
    const declared = deps[name];
    if (!declared) {
      problems.push(`${manifest}: ${name} is no longer a dependency`);
      continue;
    }
    const found = majorOf(declared);
    if (found !== wanted) {
      problems.push(
        `${manifest}: ${name} is on major ${found} (${declared}), expected ${wanted}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("Guarded dependency majors moved:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(`
A major version of one of these changes behaviour that type checking and a
successful build cannot see, and there is no test suite to catch it (#36).

If the bump is wanted, migrate deliberately, then update EXPECTED in
scripts/check-dependency-majors.mjs in the same pull request.`);
  process.exit(1);
}

console.log(
  `Guarded dependency majors unchanged (${Object.values(EXPECTED).reduce((n, e) => n + Object.keys(e).length, 0)} packages checked).`,
);
