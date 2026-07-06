"use client";
import { io, Socket } from "socket.io-client";
import {
  type ServerToClientEvents,
  type ClientToServerEvents,
} from "shared-types";
import logger from "./logger";

const URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8000";

logger.info({ socketUrl: URL }, "Initializing Socket.IO client");

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  // Websocket first: the default polling-first upgrade pays an extra HTTP
  // handshake round-trip exactly on the slow links that can least afford
  // it. tryAllTransports falls back down this list if websocket fails.
  transports: ["websocket", "polling"],
  tryAllTransports: true,
  timeout: 20_000,
});

socket.on("connect", () => {
  logger.info({ socketId: socket.id }, "Socket connected");
});

socket.on("disconnect", (reason) => {
  logger.warn({ reason }, "Socket disconnected");
});

socket.on("connect_error", (err) => {
  logger.error({ error: err.message }, "Socket connection error");
});

export { socket };
