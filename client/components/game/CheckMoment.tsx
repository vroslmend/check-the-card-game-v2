"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";

interface CheckMomentInfo {
  name: string;
  key: number;
}

// Just the caller's identity — shallow-compared so an unchanged checker across
// broadcasts doesn't re-render this out of the whole game state.
const selectChecker = (state: UIMachineSnapshot) => {
  const players = state.context.currentGameState?.players ?? {};
  const checker = Object.values(players).find((p) => p.hasCalledCheck);
  return checker ? { id: checker.id, name: checker.name } : null;
};

/**
 * Detects the instant a player's `hasCalledCheck` flips true in a broadcast
 * (purely client-side, from the synced game state — no server change) and
 * returns a momentary token that drives the CHECK. stamp. Baselines on mount
 * so a client that joins *after* Check was already called doesn't replay it.
 */
export function useCheckMoment(): CheckMomentInfo | null {
  const checker = useUISelector(selectChecker);
  const [moment, setMoment] = useState<CheckMomentInfo | null>(null);
  const prevIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      // First snapshot is the baseline: a Check that predates mount is not a
      // flip we witnessed, so don't stamp it.
      initializedRef.current = true;
      prevIdRef.current = checker?.id ?? null;
      return;
    }
    if (checker && checker.id !== prevIdRef.current) {
      setMoment({ name: checker.name, key: Date.now() });
    }
    prevIdRef.current = checker?.id ?? null;
  }, [checker]);

  useEffect(() => {
    if (!moment) return;
    // Hold the beat (~0.9s), then clear so the stamp's exit fade plays out.
    const t = setTimeout(() => setMoment(null), 1200);
    return () => clearTimeout(t);
  }, [moment]);

  return moment;
}

/**
 * The signature "CHECK." stamp: a subtly tilted ink stamp with the caller's
 * name, over a light scrim that dims the receding board. The one theatrical
 * beat allowed in live play. prefers-reduced-motion → static fade, no spring.
 */
export function CheckStamp({ moment }: { moment: CheckMomentInfo | null }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.key}
          className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-center"
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
            <span className="font-game text-6xl font-extrabold leading-none tracking-tight text-ink sm:text-8xl">
              CHECK.
            </span>
            <span className="mt-3 font-game text-base text-ink-muted sm:text-lg">
              {moment.name} called it.
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
