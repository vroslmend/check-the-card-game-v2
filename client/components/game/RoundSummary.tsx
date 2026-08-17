"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Crown, Trophy } from "lucide-react";
import { type Player, PlayerStatus } from "shared-types";
import {
  useUIActorRef,
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sounds";

interface RoundSummaryProps {
  players: Player[];
  winnerIds: string[];
  localPlayerId: string;
  /** Cumulative wins per player across rounds in this lobby. */
  playerWins: Record<string, number>;
  /** Non-host players who have signalled they want a rematch (advisory tally). */
  rematchVotes: string[];
  onPlayAgain: () => void;
  onRequestPlayAgain: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
}

const selectIsGameMaster = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

const selectGameMasterId = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.gameMasterId ?? null;

const selectCheckCallerId = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.checkDetails?.callerId ?? null;

const selectRoundEpoch = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.roundEpoch ?? 0;

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
  playerWins,
  rematchVotes,
  onPlayAgain,
  onRequestPlayAgain,
  onLeave,
  onToggleChat,
}: RoundSummaryProps) => {
  const isGameMaster = useUISelector(selectIsGameMaster);
  const gameMasterId = useUISelector(selectGameMasterId);
  const callerId = useUISelector(selectCheckCallerId);
  const roundEpoch = useUISelector(selectRoundEpoch);
  const reduced = !!useReducedMotion();

  // Rematch tally: how many of the non-host players want to play again. The
  // host isn't counted (they start the round outright); the count drives both
  // the host's "N waiting" hint and each non-host's toggle.
  const nonHostCount = players.filter((p) => p.id !== gameMasterId).length;
  const rematchCount = rematchVotes.filter((id) => id !== gameMasterId).length;
  const localWantsRematch = rematchVotes.includes(localPlayerId);

  const status = isGameMaster
    ? nonHostCount > 0
      ? `${rematchCount}/${nonHostCount} want a rematch`
      : null
    : `${rematchCount > 0 ? `${rematchCount}/${nonHostCount} in · ` : ""}Waiting for the host to start`;

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

  // playerWins accumulates for the lobby's lifetime and roundEpoch counts the
  // Play Agains, so this round is epoch + 1. By the time the sheet is up,
  // calculateScores has already credited this round's winner.
  //
  // The series standing used to live here as one sentence, which could only
  // ever name the leader and a runner-up. Past two players that hid everyone
  // else, so it now rides on the rows instead, where every player already has
  // one.
  const roundNumber = roundEpoch + 1;
  const seriesStarted = players.some((p) => (playerWins[p.id] ?? 0) > 0);

  // A panel that scrolls with nothing to say so reads as a list that ended,
  // and at a full table the rows below the fold are most of the result. The
  // marker is only up while there is something under it.
  const listRef = React.useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = React.useState(false);
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () =>
      setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // One-shot recap from the accumulated log (append-only; merged in the
  // machine). Counted once on mount. A player who reconnects mid round is
  // sent the log again, so their counts are whatever that log holds rather
  // than what they personally witnessed.
  const actorRef = useUIActorRef();
  const recap = React.useMemo(() => {
    const log = actorRef.getSnapshot().context.currentGameState?.log ?? [];
    const matches: Record<string, number> = {};
    const penalties: Record<string, number> = {};
    const abilities: Record<string, number> = {};
    for (const entry of log) {
      const aId = entry.actor?.id;
      if (!aId) continue;
      if (entry.tags.includes("penalty")) {
        penalties[aId] = (penalties[aId] ?? 0) + 1;
      } else if (entry.message.includes(" matched a")) {
        matches[aId] = (matches[aId] ?? 0) + 1;
      } else if (
        entry.tags.includes("ability") &&
        entry.message.includes(" used")
      ) {
        abilities[aId] = (abilities[aId] ?? 0) + 1;
      }
    }
    return { matches, penalties, abilities };
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
      {/* Half the viewport, and never less than the pinned row needs. The
          ceiling is what keeps the revealed hands visible, so it may not be
          raised to fit more rows; the floor only catches a screen so short
          that the buttons would clip. */}
      <div className="mx-auto flex max-h-[max(48vh,12rem)] w-full max-w-2xl flex-col gap-3 px-5 py-5 sm:px-8">
        {/* Heading and rows scroll together. Only the actions are pinned: on a
            phone the heading costs as much as the whole row list, and pinning
            it too leaves the sheet with no room to show a single score. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            <div>
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Round {roundNumber}
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

            <div className="mt-3 divide-y divide-hairline">
              {sorted.map((player, i) => {
                const isWinner = winnerIds.includes(player.id);
                const dq = player.status === PlayerStatus.DISQUALIFIED;
                const m = recap.matches[player.id] ?? 0;
                const pen = recap.penalties[player.id] ?? 0;
                const abil = recap.abilities[player.id] ?? 0;
                const attempts = m + pen;
                const accuracy =
                  attempts > 0 ? Math.round((m / attempts) * 100) : null;
                // One muted line under the name (all breakpoints; chips were
                // hidden on phones). Same dot idiom as the rematch tally below.
                const statLine = [
                  dq && "disqualified",
                  m > 0 && `${m} match${m > 1 ? "es" : ""}`,
                  pen > 0 && `${pen} penalt${pen > 1 ? "ies" : "y"}`,
                  accuracy !== null && `${accuracy}% accuracy`,
                  abil > 0 && `${abil} abilit${abil > 1 ? "ies" : "y"}`,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={player.id} className="flex items-center gap-3 py-2">
                    <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">
                      {i + 1}
                    </span>
                    {isWinner && (
                      <Crown className="h-4 w-4 shrink-0 text-accent" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-base font-bold text-ink",
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
                      {statLine && (
                        <span className="block truncate text-[11px] font-medium text-ink-muted">
                          {statLine}
                        </span>
                      )}
                    </span>
                    {/* Series wins, on every row so a six player table can see
                    the whole standing. Trophy rather than the Crown above it:
                    the crown marks who took THIS round, the trophy the series,
                    and the two would otherwise read as the same number. The
                    guard only bites on a round that produced no winner at all,
                    since this round's is credited before the sheet mounts. */}
                    {seriesStarted && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-ink-muted"
                        aria-label={`${playerWins[player.id] ?? 0} rounds won this series`}
                      >
                        <Trophy className="h-3.5 w-3.5" aria-hidden />
                        {playerWins[player.id] ?? 0}
                      </span>
                    )}
                    <ScoreStamp
                      value={player.score}
                      delay={FIRST_STAMP_DELAY_S + i * STAMP_STAGGER_S}
                      reduced={reduced}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {moreBelow && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end justify-center"
              style={{
                background:
                  "linear-gradient(to top, var(--color-surface), hsl(var(--surface) / 0))",
              }}
            >
              <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
            </div>
          )}
        </div>

        {/* The status line takes a row of its own rather than sitting between
            the buttons. Wedged in the middle it pushed each button onto its
            own line, and on a phone that cost more height than the scores. */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          {isGameMaster ? (
            <button
              onClick={() => {
                play("click");
                onPlayAgain();
              }}
              className="flex h-11 items-center rounded-full bg-accent px-6 text-sm font-bold text-accent-ink transition-colors hover:bg-accent/90"
            >
              Play again
            </button>
          ) : (
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
              {localWantsRematch
                ? "Ready for a rematch"
                : "I want to play again"}
            </button>
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
          {status && (
            <span className="basis-full text-sm font-semibold text-ink-muted">
              {status}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
