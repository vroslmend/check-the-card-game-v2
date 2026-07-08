"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import { type Player, PlayerStatus } from "shared-types";
import { useUIActorRef, useUISelector } from "@/context/GameUIContext";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sounds";

interface RoundSummaryProps {
  players: Player[];
  winnerIds: string[];
  localPlayerId: string;
  /** Non-host players who have signalled they want a rematch (advisory tally). */
  rematchVotes: string[];
  onPlayAgain: () => void;
  onRequestPlayAgain: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
}

const selectIsGameMaster = (state: any) =>
  state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

const selectGameMasterId = (state: any) =>
  state.context.currentGameState?.gameMasterId ?? null;

const selectCheckCallerId = (state: any) =>
  state.context.currentGameState?.checkDetails?.callerId ?? null;

// The table ripple upstairs runs ~1.5s after the panel mounts (PlayerHand's
// stagger); scores stamp in as it finishes.
const FIRST_STAMP_DELAY_S = 0.9;
const STAMP_STAGGER_S = 0.12;

const ScoreStamp = ({
  value,
  delay,
  reduced,
}: {
  value: number;
  delay: number;
  reduced: boolean;
}) => (
  <motion.span
    className="text-2xl font-extrabold tabular-nums text-ink"
    initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.12 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={
      reduced
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 18, delay }
    }
  >
    {value}
  </motion.span>
);

export const RoundSummary = ({
  players,
  winnerIds,
  localPlayerId,
  rematchVotes,
  onPlayAgain,
  onRequestPlayAgain,
  onLeave,
  onToggleChat,
}: RoundSummaryProps) => {
  const isGameMaster = useUISelector(selectIsGameMaster);
  const gameMasterId = useUISelector(selectGameMasterId);
  const callerId = useUISelector(selectCheckCallerId);
  const reduced = !!useReducedMotion();

  // Rematch tally: how many of the non-host players want to play again. The
  // host isn't counted (they start the round outright); the count drives both
  // the host's "N waiting" hint and each non-host's toggle.
  const nonHostCount = players.filter((p) => p.id !== gameMasterId).length;
  const rematchCount = rematchVotes.filter((id) => id !== gameMasterId).length;
  const localWantsRematch = rematchVotes.includes(localPlayerId);

  const winners = players.filter((p) => winnerIds.includes(p.id));
  const sorted = [...players].sort((a, b) => a.score - b.score);
  const caller = callerId ? players.find((p) => p.id === callerId) : null;

  // A shared lowest score is a tie, not a group of separate winners: name it
  // that way. Two tied read as "A and B tie"; three or more as "It's a tie".
  const title =
    winners.length === 0
      ? "Round over"
      : winners.length === 1
        ? `${winners[0]!.name} wins`
        : winners.length === 2
          ? `${winners[0]!.name} and ${winners[1]!.name} tie`
          : "It's a tie";
  const caption = caller
    ? `${caller.name} called Check.`
    : "The round ended without a Check.";

  // One-shot recap from the accumulated log (append-only; merged in the
  // machine). Counted once on mount. Late joiners hold only a log tail, so
  // counts can undercount for them.
  const actorRef = useUIActorRef();
  const recap = React.useMemo(() => {
    const log = actorRef.getSnapshot().context.currentGameState?.log ?? [];
    const matches: Record<string, number> = {};
    const penalties: Record<string, number> = {};
    for (const entry of log) {
      const aId = entry.actor?.id;
      if (!aId) continue;
      if (entry.tags.includes("penalty")) {
        penalties[aId] = (penalties[aId] ?? 0) + 1;
      } else if (entry.message.includes(" matched a")) {
        matches[aId] = (matches[aId] ?? 0) + 1;
      }
    }
    return { matches, penalties };
  }, [actorRef]);

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface font-game"
      initial={reduced ? { y: 0 } : { y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 30, delay: 0.35 }
      }
    >
      <div className="mx-auto flex max-h-[50vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto px-5 py-5 sm:px-8 lg:max-h-[34vh]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Round over
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {title}
          </h2>
          {winners.length > 0 && (
            <motion.div
              className="mt-2 h-1 rounded-full bg-accent"
              style={{ originX: 0, width: "clamp(4rem, 30%, 10rem)" }}
              initial={{ scaleX: reduced ? 1 : 0 }}
              animate={{ scaleX: 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.9 }
              }
            />
          )}
          <p className="mt-2 text-sm text-ink-muted">{caption}</p>
        </div>

        <div className="divide-y divide-hairline">
          {sorted.map((player, i) => {
            const isWinner = winnerIds.includes(player.id);
            const dq = player.status === PlayerStatus.DISQUALIFIED;
            const m = recap.matches[player.id] ?? 0;
            const pen = recap.penalties[player.id] ?? 0;
            return (
              <div key={player.id} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">
                  {i + 1}
                </span>
                {isWinner && <Crown className="h-4 w-4 shrink-0 text-accent" />}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-base font-bold text-ink",
                    dq && "text-ink-muted line-through",
                  )}
                >
                  {player.name}
                  {player.id === localPlayerId && (
                    <span className="ml-1.5 text-xs font-normal text-ink-muted">
                      (you)
                    </span>
                  )}
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  {dq && (
                    <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                      disqualified
                    </span>
                  )}
                  {m > 0 && (
                    <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                      {m} match{m > 1 ? "es" : ""}
                    </span>
                  )}
                  {pen > 0 && (
                    <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                      {pen} penalt{pen > 1 ? "ies" : "y"}
                    </span>
                  )}
                  <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                    {player.hand.length} cards
                  </span>
                </span>
                <ScoreStamp
                  value={player.score}
                  delay={FIRST_STAMP_DELAY_S + i * STAMP_STAGGER_S}
                  reduced={reduced}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {isGameMaster ? (
            <>
              <button
                onClick={() => {
                  play("click");
                  onPlayAgain();
                }}
                className="flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent/90"
              >
                Play again
              </button>
              {nonHostCount > 0 && (
                <span className="text-sm font-semibold text-ink-muted">
                  {rematchCount}/{nonHostCount} want a rematch
                </span>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  play("click");
                  onRequestPlayAgain();
                }}
                aria-pressed={localWantsRematch}
                className={cn(
                  "flex h-11 items-center rounded-full px-6 text-sm font-bold transition-colors",
                  localWantsRematch
                    ? "bg-accent text-accent-ink hover:bg-accent/90"
                    : "border border-hairline bg-surface text-ink hover:border-ink-muted",
                )}
              >
                {localWantsRematch ? "Ready for a rematch" : "I want to play again"}
              </button>
              <span className="text-sm font-semibold text-ink-muted">
                {rematchCount > 0 && `${rematchCount}/${nonHostCount} in · `}
                Waiting for the host to start
              </span>
            </>
          )}
          <button
            onClick={() => {
              play("click");
              onToggleChat();
            }}
            className="flex h-11 items-center rounded-full border border-hairline bg-surface px-5 text-sm font-semibold text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
          >
            Table talk
          </button>
          <button
            onClick={onLeave}
            className="text-sm font-semibold text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            Back to home
          </button>
        </div>
      </div>
    </motion.div>
  );
};
