"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { CardRank } from "shared-types";
import { claimStampSlot } from "@/lib/stampQueue";

const ABILITY_HOLD_MS = 1100;
const ABILITY_SLOT_MS = 1400;

const RANK_WORDS: Partial<Record<string, string>> = {
  [CardRank.King]: "KING.",
  [CardRank.Queen]: "QUEEN.",
  [CardRank.Jack]: "JACK.",
};

interface AbilityMomentInfo {
  key: string;
  title: string;
  caption: string;
}

/** The ability stack as one shallow-comparable string: rank and owner name
 *  per entry, in push order. Unrelated broadcasts leave it identical. */
const selectAbilityStackKey = (state: UIMachineSnapshot) => {
  const gs = state.context.currentGameState;
  if (!gs?.abilityStack?.length) return "";
  return gs.abilityStack
    .map(
      (a) =>
        `${a.sourceCard.rank}:${gs.players[a.playerId]?.name ?? "Someone"}`,
    )
    .join("|");
};

/**
 * Fires a momentary token when a K/Q/J ability lands on the stack — the
 * table-wide announcement the owner asked for, one register below PENALTY.
 * A matched special pushes TWO abilities in one broadcast (LIFO): the stamp
 * reads as a combo and the caption says who resolves first. Baselines on
 * mount so a rejoin mid-ability doesn't replay it.
 */
export function useAbilityMoment(): AbilityMomentInfo | null {
  const stackKey = useUISelector(selectAbilityStackKey);
  const [moment, setMoment] = useState<AbilityMomentInfo | null>(null);
  const prevRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = stackKey;
      return;
    }
    const prev = prevRef.current ?? "";
    prevRef.current = stackKey;
    if (!stackKey) return;
    const prevEntries = prev ? prev.split("|") : [];
    const entries = stackKey.split("|");
    if (entries.length <= prevEntries.length) return;
    const added = entries.slice(prevEntries.length).map((e) => {
      const [rank, ...name] = e.split(":");
      return { rank: rank!, name: name.join(":") };
    });
    const word = RANK_WORDS[added[0]!.rank];
    if (!word) return;
    const next: AbilityMomentInfo =
      added.length === 1
        ? {
            key: stackKey,
            title: word,
            caption: `${added[0]!.name} plays it.`,
          }
        : {
            // Push order is [discarder, matcher]; the matcher resolves first.
            key: stackKey,
            title: `${word} ×${added.length}`,
            caption: added.every((a) => a.name === added[0]!.name)
              ? `${added[0]!.name} plays both.`
              : `${added[added.length - 1]!.name} first, then ${added[0]!.name}.`,
          };
    // Queue behind any stamp already playing (a matched-last-card special
    // raises CHECK. from the same broadcast; CHECK. goes first).
    const delay = claimStampSlot(ABILITY_SLOT_MS);
    const t = setTimeout(() => setMoment(next), delay);
    return () => clearTimeout(t);
  }, [stackKey]);

  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setMoment(null), ABILITY_HOLD_MS);
    return () => clearTimeout(t);
  }, [moment]);

  return moment;
}

/** The ability stamp: CHECK.'s visual language, sized between the pile chips
 *  and PENALTY. pointer-events-none, so target selection continues under it. */
export function AbilityStamp({
  moment,
}: {
  moment: AbilityMomentInfo | null;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.key}
          className="pointer-events-none absolute inset-0 z-[54] flex flex-col items-center justify-center"
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
              {moment.title}
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
