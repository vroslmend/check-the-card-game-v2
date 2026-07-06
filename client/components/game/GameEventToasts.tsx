"use client";

import React from "react";
import { toast } from "sonner";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";

const selectLog = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.log ?? null;

/**
 * Surfaces public game events (match results, penalties, disqualifications,
 * reshuffles) as transient toasts. The SidePanel keeps the full history, but
 * nobody has it open mid-hand. Ability events stay off the toasts — the
 * board rings already show those in place.
 */
export const GameEventToasts = () => {
  const log = useUISelector(selectLog);
  // Everything present on first sight (mount, rejoin) is history, not news.
  const seenIds = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    if (!log) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(log.map((entry) => entry.id));
      return;
    }
    for (const entry of log) {
      if (seenIds.current.has(entry.id)) continue;
      seenIds.current.add(entry.id);
      if (
        entry.type === "public" &&
        entry.tags.includes("game-event") &&
        !entry.tags.includes("ability") &&
        // Penalties get the center PENALTY. stamp — not a toast as well.
        !entry.tags.includes("penalty")
      ) {
        toast(entry.message, { duration: 4000 });
      }
    }
  }, [log]);

  return null;
};
