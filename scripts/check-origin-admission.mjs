// Guards the browser-origin boundary at the Engine.IO handshake. Socket.IO's
// cors option controls response headers, but a WebSocket connection must be
// refused explicitly through allowRequest. This check uses real WebSocket
// handshakes so it cannot pass by only configuring CORS headers.
//
// Run from the repo root, after npm run build:server-deps.

import { spawnSync } from "node:child_process";

process.env.NODE_ENV = "production";
process.env.PORT = "8233";
process.env.CORS_ORIGIN = "https://official.example";

const missingConfigEnv = { ...process.env, PORT: "8234" };
delete missingConfigEnv.CORS_ORIGIN;
const missingConfig = spawnSync(process.execPath, ["server/dist/index.js"], {
  cwd: process.cwd(),
  env: missingConfigEnv,
  encoding: "utf8",
  timeout: 3_000,
});

const { io: ioc } = await import("socket.io-client");
const { httpServer } = await import("../server/dist/index.js");

const URL = "http://127.0.0.1:8233";
let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(
    `  ${passed ? "PASS" : "FAIL"}  ${name}${detail && `  ${detail}`}`,
  );
  if (!passed) failures++;
};

const attemptConnection = (origin) =>
  new Promise((resolve) => {
    const socket = ioc(URL, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 2_000,
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    });
    const settle = (result) => {
      socket.removeAllListeners();
      socket.close();
      resolve(result);
    };
    socket.once("connect", () => settle("connected"));
    socket.once("connect_error", () => settle("rejected"));
  });

console.log("\nProduction origin admission:");
const allowed = await attemptConnection("https://official.example");
check("the configured frontend can connect", allowed === "connected", allowed);

const unlisted = await attemptConnection("https://fork.example");
check(
  "an unlisted browser origin is rejected",
  unlisted === "rejected",
  unlisted,
);

const missing = await attemptConnection();
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

await new Promise((resolve) => httpServer.close(resolve));

if (failures > 0) {
  console.error(`
${failures} origin-admission check${failures === 1 ? "" : "s"} failed.

Production must fail closed: only an explicitly listed browser Origin may
finish the Engine.IO handshake, and the server must not start without that
list. Treat a failure here as the official backend being open to forked web
frontends.`);
  process.exit(1);
}

console.log("\nProduction admits only explicitly configured browser origins.");
process.exit(0);
