"use client";

import { useEffect } from "react";
import { SERVER_URL } from "@/lib/socket";

/** Render's free tier spins a service down after ~15 minutes without inbound
 *  HTTP traffic — and frames on an already-open WebSocket don't reliably
 *  count, so a lobby full of connected-but-waiting players could have the
 *  server yanked out from under it. While a game page is open, GET /health
 *  (which exists for exactly this: server/src/index.ts) on a cadence well
 *  inside that window so the platform always sees live traffic.
 *
 *  4 minutes also stays inside Chrome's once-per-minute background-tab timer
 *  throttle (pages holding an open socket are exempt from the harsher
 *  once-per-hour tier), so a backgrounded lobby tab keeps the server warm
 *  too. no-cors: the response body is irrelevant, reaching the server is the
 *  point — this keeps cross-origin console noise out even if CORS headers
 *  ever drift. */
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function useServerKeepalive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${SERVER_URL}/health`, {
        mode: "no-cors",
        cache: "no-store",
      }).catch(() => {
        // Offline / server asleep: nothing to do — the socket layer owns
        // reconnection and its own user-facing status.
      });
    };
    const id = setInterval(ping, KEEPALIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
