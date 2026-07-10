"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Flag,
  Info,
  Shuffle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { GameStage } from "shared-types";

const CAPTION_VISIBLE_MS = 4000;

// Display-only glyph — same mapping the retired toast rail used.
const glyphFor = (message: string): LucideIcon => {
  const m = message.toLowerCase();
  if (m.includes("matched")) return Sparkles;
  if (m.includes("shuffled")) return Shuffle;
  if (m.includes("disqualified")) return Ban;
  return Info;
};

const selectCaptionContext = (state: UIMachineSnapshot) => {
  const gs = state.context.currentGameState;
  const callerId = gs?.checkDetails?.callerId ?? null;
  return {
    log: gs?.log ?? null,
    isFinalTurns: gs?.gameStage === GameStage.FINAL_TURNS,
    callerName: callerId ? (gs?.players[callerId]?.name ?? null) : null,
  };
};

interface Caption {
  id: string;
  message: string;
}

/**
 * The table's caption voice: transient game-event announcements (matches,
 * reshuffles, disqualifications) crossfade through a fixed-height rail under
 * the header, and FINAL_TURNS holds a persistent line there. Replaces the
 * floating toast rail, which sat on top of the opponent strip. Fixed height
 * so appearing/disappearing text never reflows the board.
 */
export const GameEventCaption = () => {
  const { log, isFinalTurns, callerName } =
    useUISelector(selectCaptionContext);
  const [caption, setCaption] = React.useState<Caption | null>(null);
  // Everything present on first sight (mount, rejoin) is history, not news.
  const seenIds = React.useRef<Set<string> | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!log) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(log.map((e) => e.id));
      return;
    }
    let latest: Caption | null = null;
    for (const entry of log) {
      if (seenIds.current.has(entry.id)) continue;
      seenIds.current.add(entry.id);
      if (
        entry.type === "public" &&
        entry.tags.includes("game-event") &&
        !entry.tags.includes("ability") &&
        !entry.tags.includes("penalty")
      ) {
        latest = { id: entry.id, message: entry.message };
      }
    }
    if (latest) {
      setCaption(latest);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => setCaption(null),
        CAPTION_VISIBLE_MS,
      );
    }
  }, [log]);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const Icon = caption ? glyphFor(caption.message) : Flag;

  return (
    <div
      className="flex h-[clamp(1.5rem,4svh,1.75rem)] items-center justify-center font-game"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {caption ? (
          <motion.div
            key={caption.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <span>{caption.message}</span>
          </motion.div>
        ) : isFinalTurns && callerName ? (
          <motion.div
            key="final-turns"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-2 text-sm font-semibold text-ink-muted"
          >
            <Flag className="h-3.5 w-3.5 shrink-0" />
            <span>Final turns. {callerName} called Check.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
