// Starts the compiled server inside the check's own process, on a free port.

import { HeadlessPlayer } from "../../tools/probe/player.mjs";

export const ORIGIN = "http://localhost:3000";

let started = false;

// index.js reads its whole configuration from the environment when it is
// imported, and listens as it loads, so there is one server per process.
export const startServer = async (env = {}) => {
  if (started) {
    throw new Error("startServer was already called in this process.");
  }
  started = true;

  process.env.NODE_ENV = "production";
  process.env.PORT = "0";
  process.env.CORS_ORIGIN = ORIGIN;
  for (const [name, value] of Object.entries(env)) {
    process.env[name] = String(value);
  }

  const { httpServer, io } = await import("../../server/dist/index.js");
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  const url = `http://127.0.0.1:${httpServer.address().port}`;

  const players = [];
  // A player the way a production browser connects: with its Origin, and with
  // no automatic reconnect, so a check decides when a socket comes back. Pass
  // `origin: null` to connect with no Origin at all.
  const player = (
    name,
    { origin = process.env.CORS_ORIGIN, headers = {} } = {},
  ) => {
    const p = new HeadlessPlayer(name, {
      url,
      headers: { ...(origin ? { Origin: origin } : {}), ...headers },
      reconnection: false,
    });
    players.push(p);
    return p;
  };

  const close = async () => {
    for (const p of players) p.disconnect();
    await new Promise((resolve) => httpServer.close(resolve));
  };

  return { httpServer, io, url, player, close };
};
