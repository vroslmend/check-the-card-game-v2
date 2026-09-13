// Guards the browser-origin boundary at the Engine.IO handshake. Socket.IO's
// cors option controls response headers, but a WebSocket connection must be
// refused explicitly through allowRequest. This check uses real WebSocket
// handshakes so it cannot pass by only configuring CORS headers.
//
// Run from the repo root, after npm run build:server-deps.

import { spawnSync } from "node:child_process";

import { createReport } from "./lib/report.mjs";
import { startServer } from "./lib/server.mjs";

const OFFICIAL = "https://official.example";
const server = await startServer({ CORS_ORIGIN: OFFICIAL });
const { check, finish } = createReport();

const missingConfigEnv = { ...process.env, PORT: "0" };
delete missingConfigEnv.CORS_ORIGIN;
const missingConfig = spawnSync(process.execPath, ["server/dist/index.js"], {
  cwd: process.cwd(),
  env: missingConfigEnv,
  encoding: "utf8",
  timeout: 3_000,
});

const attemptConnection = async (origin) => {
  const player = server.player("Origin check", { origin });
  try {
    await player.connected();
    return "connected";
  } catch {
    return "rejected";
  } finally {
    player.disconnect();
  }
};

console.log("\nProduction origin admission:");
const allowed = await attemptConnection(OFFICIAL);
check("the configured frontend can connect", allowed === "connected", allowed);

const unlisted = await attemptConnection("https://fork.example");
check(
  "an unlisted browser origin is rejected",
  unlisted === "rejected",
  unlisted,
);

const missing = await attemptConnection(null);
check(
  "a production handshake without Origin is rejected",
  missing === "rejected",
  missing,
);

const missingConfigOutput = `${missingConfig.stdout ?? ""}\n${
  missingConfig.stderr ?? ""
}`;
check(
  "production startup fails without an explicit allowlist",
  missingConfig.status !== 0 && /CORS_ORIGIN/.test(missingConfigOutput),
  `status=${missingConfig.status} signal=${missingConfig.signal ?? "none"}`,
);

await server.close();

finish({
  passed: () =>
    "\nProduction admits only explicitly configured browser origins.",
  failed: (failures) => `
${failures} origin-admission check${failures === 1 ? "" : "s"} failed.

Production must fail closed: only an explicitly listed browser Origin may
finish the Engine.IO handshake, and the server must not start without that
list. Treat a failure here as the official backend being open to forked web
frontends.`,
});
