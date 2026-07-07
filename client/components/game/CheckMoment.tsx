"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { claimStampSlot } from "@/lib/stampQueue";

// Visible hold + exit fade; also the stamp-slot claim so queued stamps
// start as this one's fade completes.
const CHECK_HOLD_MS = 1200;
const CHECK_SLOT_MS = 1500;

interface CheckMomentInfo {
  name: string;
  caption: string;
  key: number;
}

// The full set of players who have called Check, as one shallow-comparable
// string (`id:handCount:name` per checker, join order). Selecting the whole
// set — not just the first match — means a SECOND check during FINAL_TURNS
// (a player emptying their hand after someone already called) is still seen;
// the old `.find(hasCalledCheck)` returned the first checker forever, so that
// second call either mis-stamped or, since MATCH. stands down for an empty
// hand, produced no announcement at all. handCount distinguishes the button
// path (>0) from the matched-last-card path (0).
const selectCheckersKey = (state: UIMachineSnapshot) => {
  const players = state.context.currentGameState?.players ?? {};
  return Object.values(players)
    .filter((p) => p.hasCalledCheck)
    .map((p) => `${p.id}:${p.hand.length}:${p.name}`)
    .join("|");
};

/**
 * Detects the instant a player's `hasCalledCheck` flips true in a broadcast
 * (purely client-side, from the synced game state — no server change) and
 * returns a momentary token that drives the CHECK. stamp. Baselines on mount
 * so a client that joins *after* Check was already called doesn't replay it.
 * An empty hand means the check came from matching the last card away — the
 * caption tells that story, and the MATCH. stamp stands down for it.
 */
export function useCheckMoment(): CheckMomentInfo | null {
  const checkersKey = useUISelector(selectCheckersKey);
  const [moment, setMoment] = useState<CheckMomentInfo | null>(null);
  const prevIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const entries = checkersKey ? checkersKey.split("|") : [];
    const parsed = entries.map((e) => {
      const [id, handCount, ...name] = e.split(":");
      return { id: id!, handCount: Number(handCount), name: name.join(":") };
    });
    const ids = new Set(parsed.map((p) => p.id));

    if (prevIdsRef.current === null) {
      // First snapshot is the baseline: a Check that predates mount is not a
      // flip we witnessed, so don't stamp it.
      prevIdsRef.current = ids;
      return;
    }
    const added = parsed.filter((p) => !prevIdsRef.current!.has(p.id));
    prevIdsRef.current = ids;
    if (added.length === 0) return;

    // Stamp the newest caller (button check or a matched last card). Two in
    // one broadcast is vanishingly rare; the last one wins the beat.
    const checker = added[added.length - 1]!;
    const caption =
      checker.handCount === 0
        ? `${checker.name} matched their last card.`
        : `${checker.name} called it.`;
    const delay = claimStampSlot(CHECK_SLOT_MS);
    const t = setTimeout(
      () => setMoment({ name: checker.name, caption, key: Date.now() }),
      delay,
    );
    return () => clearTimeout(t);
  }, [checkersKey]);

  useEffect(() => {
    if (!moment) return;
    // Hold the beat, then clear so the stamp's exit fade plays out.
    const t = setTimeout(() => setMoment(null), CHECK_HOLD_MS);
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
              {moment.caption}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
