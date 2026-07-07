"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { claimStampSlot } from "@/lib/stampQueue";

const PENALTY_HOLD_MS = 1200;
const PENALTY_SLOT_MS = 1500;

interface PenaltyMomentInfo {
  name: string;
  key: string;
}

// Latest penalty log entry, as primitives — shallow-compared so unrelated
// broadcasts don't re-render this.
const selectLatestPenalty = (state: UIMachineSnapshot) => {
  const log = state.context.currentGameState?.log;
  if (!log) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (entry.type === "public" && entry.tags.includes("penalty")) {
      return { id: entry.id, name: entry.actor?.name ?? null };
    }
  }
  return null;
};

/**
 * Fires a momentary token when a NEW penalty lands in the log (a failed match
 * attempt drew someone an extra card — information the table doesn't get from
 * board motion alone). Baselines on mount so a client that joins after a
 * penalty doesn't replay it — same rule as useCheckMoment.
 */
export function usePenaltyMoment(): PenaltyMomentInfo | null {
  const latest = useUISelector(selectLatestPenalty);
  const [moment, setMoment] = useState<PenaltyMomentInfo | null>(null);
  const prevIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevIdRef.current = latest?.id ?? null;
      return;
    }
    if (latest && latest.id !== prevIdRef.current && latest.name) {
      prevIdRef.current = latest.id;
      // Queue behind any stamp already playing (two players can earn
      // MATCH. and PENALTY. inside one matching window).
      const delay = claimStampSlot(PENALTY_SLOT_MS);
      const t = setTimeout(
        () => setMoment({ name: latest.name!, key: latest.id }),
        delay,
      );
      return () => clearTimeout(t);
    }
    prevIdRef.current = latest?.id ?? null;
  }, [latest]);

  useEffect(() => {
    if (!moment) return;
    // Hold the beat, then clear so the exit fade plays out.
    const t = setTimeout(() => setMoment(null), PENALTY_HOLD_MS);
    return () => clearTimeout(t);
  }, [moment]);

  return moment;
}

/**
 * The PENALTY. stamp: CheckMoment's visual language one register down (the
 * MATCH? slot it replaces announced a non-event; a penalty is actual news).
 * No board scale — the recede stays unique to CHECK.
 */
export function PenaltyStamp({
  moment,
}: {
  moment: PenaltyMomentInfo | null;
}) {
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
            <span className="font-game text-5xl font-extrabold leading-none tracking-tight text-ink sm:text-7xl">
              PENALTY.
            </span>
            <span className="mt-3 font-game text-base text-ink-muted sm:text-lg">
              {moment.name} mismatched.
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
