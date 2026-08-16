// A player that is not a browser.
//
// Every player except the one being observed is one of these. They act the
// instant the server lets them, which is what makes a scripted round take
// seconds instead of the minutes it takes to drive two browsers by hand.
//
// #75 wants the same thing for wire-level assertions, so this is a module with
// an action API rather than a script. Keep it that way: two drivers would
// drift, and the whole point is that there is one.

import { io } from "socket.io-client";

const SERVER = process.env.PROBE_SERVER_URL ?? "http://localhost:8000";

/** Resolves when `predicate(state)` holds, or rejects on timeout. Every wait in
 *  the driver goes through this rather than a sleep, so a slow machine costs
 *  latency instead of a flake. */
const waitFor = (player, predicate, label, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    if (player.state && predicate(player.state)) return resolve(player.state);
    const timer = setTimeout(() => {
      player.off(check);
      // A timeout is nearly always a rejected action rather than a slow one,
      // and the server answers a rejection with ERROR_MESSAGE rather than by
      // failing the emit. Without these the failure says nothing.
      const s = player.state;
      const detail = s
        ? `stage=${s.gameStage} phase=${s.turnPhase} ` +
          `turn=${s.currentPlayerId === player.id ? "mine" : (s.currentPlayerId ?? "none")}`
        : "no state received";
      const errors = player.errors.length
        ? `\n  server said: ${player.errors.slice(-3).join("; ")}`
        : "\n  server reported no error, so the action was accepted and did not change this";
      reject(
        new Error(
          `${player.name} timed out after ${timeoutMs}ms waiting for ${label}\n  ${detail}${errors}`,
        ),
      );
    }, timeoutMs);
    const check = (state) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      player.off(check);
      resolve(state);
    };
    player.on(check);
  });

export class HeadlessPlayer {
  constructor(name) {
    this.name = name;
    this.id = null;
    this.gameId = null;
    this.state = null;
    this.errors = [];
    this.listeners = new Set();
    this.socket = io(SERVER, { transports: ["websocket"] });
    this.socket.on("GAME_STATE_UPDATE", (state) => {
      this.state = state;
      for (const l of [...this.listeners]) l(state);
    });
    this.socket.on("ERROR_MESSAGE", (e) => this.errors.push(e?.message ?? e));
  }

  on(fn) {
    this.listeners.add(fn);
  }
  off(fn) {
    this.listeners.delete(fn);
  }

  #emit(event, ...args) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${event} never acknowledged`)),
        10000,
      );
      this.socket.emit(event, ...args, (response) => {
        clearTimeout(timer);
        if (!response?.success) {
          return reject(
            new Error(`${event} failed: ${response?.message ?? "no reason"}`),
          );
        }
        resolve(response);
      });
    });
  }

  async connected() {
    if (this.socket.connected) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no connection to ${SERVER}`)),
        10000,
      );
      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once("connect_error", (e) => {
        clearTimeout(timer);
        reject(new Error(`connection to ${SERVER} refused: ${e.message}`));
      });
    });
  }

  async createGame({ seats }) {
    await this.connected();
    const res = await this.#emit("CREATE_GAME", {
      name: this.name,
      maxPlayers: seats,
    });
    this.id = res.playerId;
    this.gameId = res.gameId;
    return res.gameId;
  }

  async joinGame(gameId) {
    await this.connected();
    const res = await this.#emit("JOIN_GAME", gameId, { name: this.name });
    this.id = res.playerId;
    this.gameId = gameId;
    return res.playerId;
  }

  /** Fire and forget: the server answers every action with a broadcast, not an
   *  ack, so callers wait on state rather than on this. */
  act(type, payload) {
    this.socket.emit("PLAYER_ACTION", { type, payload });
  }

  waitFor(predicate, label, timeoutMs) {
    return waitFor(this, predicate, label, timeoutMs);
  }

  /** True once this player is the one the server is waiting on. */
  get isMyTurn() {
    return this.state?.currentPlayerId === this.id;
  }

  disconnect() {
    this.socket.close();
  }
}
