"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { PlayingCard } from "../cards/PlayingCard";
import type { Card } from "shared-types";

interface MatchMomentInfo {
  card: Card;
  key: string;
}

// Just the open window's identity, as primitives — shallow-compared so
// re-broadcasts of the same window don't re-render this.
const selectMatchWindow = (state: UIMachineSnapshot) => {
  const mo = state.context.currentGameState?.matchingOpportunity;
  if (!mo) return null;
  return {
    key: `${mo.cardToMatch.id}:${mo.startTimestamp}`,
    id: mo.cardToMatch.id,
    rank: mo.cardToMatch.rank,
    suit: mo.cardToMatch.suit,
  };
};

/**
 * Fires a momentary token when a NEW matching window opens (keyed by card +
 * startTimestamp, so re-broadcasts and failed attempts inside one window
 * can't re-stamp). Baselines on mount so a client that joins mid-window
 * doesn't replay it — same rule as useCheckMoment.
 */
export function useMatchMoment(): MatchMomentInfo | null {
  const window = useUISelector(selectMatchWindow);
  const [moment, setMoment] = useState<MatchMomentInfo | null>(null);
  const prevKeyRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevKeyRef.current = window?.key ?? null;
      return;
    }
    if (window && window.key !== prevKeyRef.current) {
      setMoment({
        card: { id: window.id, rank: window.rank, suit: window.suit } as Card,
        key: window.key,
      });
    }
    prevKeyRef.current = window?.key ?? null;
  }, [window]);

  useEffect(() => {
    if (!moment) return;
    // Stamp the beat, then clear well inside the 5s window so the board is
    // fully readable for the select/pass flow.
    const t = setTimeout(() => setMoment(null), 1400);
    return () => clearTimeout(t);
  }, [moment]);

  return moment;
}

/**
 * The MATCH? stamp: the rank to match as a real card slapped on the table
 * over a light scrim — CheckMoment's visual language one register quieter.
 * No board scale (the recede stays unique to CHECK.), pointer-events-none:
 * the matching flow runs undisturbed in the action bar.
 */
export function MatchStamp({ moment }: { moment: MatchMomentInfo | null }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.key}
          className="pointer-events-none absolute inset-0 z-[55] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute inset-0 bg-ground/40" />
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
            <div className="w-16 rotate-[-4deg] rounded-card shadow-lg sm:w-20">
              <div className="aspect-[5/7]">
                <PlayingCard card={moment.card} className="h-full w-full" />
              </div>
            </div>
            <span className="mt-4 font-game text-5xl font-extrabold leading-none tracking-tight text-ink sm:text-7xl">
              MATCH?
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
