"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";

// The stamp lands with the card (cardTravelTransition = 0.65s), together
// with the pile pulse and the match chime.
const MATCH_FLIGHT_MS = 650;

interface MatchMomentInfo {
  key: string;
  caption: string;
}

/** Latest successful-match announcement, as primitives. Special ranks are
 *  excluded: a matched King/Queen/Jack pushes abilities and the KING. x2
 *  stamp owns that moment. */
const selectLatestMatch = (state: UIMachineSnapshot) => {
  const log = state.context.currentGameState?.log;
  if (!log) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (
      entry.type === "public" &&
      entry.tags.includes("game-event") &&
      entry.message.includes(" matched a")
    ) {
      return {
        id: entry.id,
        message: entry.message,
        isSpecial: /King|Queen|Jack/.test(entry.message),
      };
    }
  }
  return null;
};

/**
 * Fires a momentary token when a NEW regular-rank match lands (aces and
 * number cards) — the success counterpart to PENALTY., one register down.
 * Delayed to the card's landing; baselined on mount like every stamp.
 */
export function useMatchMoment(): MatchMomentInfo | null {
  const latest = useUISelector(selectLatestMatch);
  const [moment, setMoment] = useState<MatchMomentInfo | null>(null);
  const prevIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevIdRef.current = latest?.id ?? null;
      return;
    }
    if (latest && latest.id !== prevIdRef.current) {
      prevIdRef.current = latest.id;
      if (!latest.isSpecial) {
        const arm = setTimeout(
          () => setMoment({ key: latest.id, caption: latest.message }),
          MATCH_FLIGHT_MS,
        );
        return () => clearTimeout(arm);
      }
      return;
    }
    prevIdRef.current = latest?.id ?? null;
  }, [latest]);

  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setMoment(null), 1100);
    return () => clearTimeout(t);
  }, [moment]);

  return moment;
}

/** The MATCH. stamp: the same stamp grammar as the ability moments, with
 *  the log's own sentence as the caption ("Bob matched a 10."). */
export function MatchStamp({ moment }: { moment: MatchMomentInfo | null }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.key}
          className="pointer-events-none absolute inset-0 z-[53] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-ground/30" />
          <motion.div
            className="relative flex flex-col items-center text-center"
            initial={
              reduced ? { opacity: 0 } : { scale: 1.12, rotate: 0, opacity: 0 }
            }
            animate={
              reduced ? { opacity: 1 } : { scale: 1, rotate: -2, opacity: 1 }
            }
            transition={
              reduced
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 260, damping: 18 }
            }
          >
            <span className="font-game text-4xl font-extrabold leading-none tracking-tight text-ink sm:text-6xl">
              MATCH.
            </span>
            <span className="mt-2 font-game text-sm text-ink-muted sm:text-base">
              {moment.caption}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
