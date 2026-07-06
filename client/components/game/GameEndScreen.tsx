"use client";

import React, { useEffect, useState } from "react";
import { type Player, type Card, PlayerStatus } from "shared-types";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { cn } from "@/lib/utils";
import { useUISelector, useUIActorRef } from "@/context/GameUIContext";

interface GameEndScreenProps {
  players: Player[];
  winnerIds: string[];
  localPlayerId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const selectIsGameMaster = (state: any) =>
  state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

const selectCheckCallerId = (state: any) =>
  state.context.currentGameState?.checkDetails?.callerId ?? null;

// Scores count up in accent — the animated payoff of the reveal. Static under
// reduced-motion (starts already at the final value).
const CountUp = ({ value, reduced }: { value: number; reduced: boolean }) => {
  const mv = useMotionValue(reduced ? value : 0);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: "easeOut",
      delay: 0.3,
    });
    return () => controls.stop();
  }, [value, reduced, mv]);
  return <motion.span>{text}</motion.span>;
};

// One card in the reveal ripple: it renders face-down, then flips to its face
// after `delayMs` (using the existing PlayingCard flip). Face-down cards (a
// redaction gap) stay down; reduced-motion shows the face immediately.
const RevealCard = ({
  card,
  delayMs,
  reduced,
}: {
  card: Player["hand"][number];
  delayMs: number;
  reduced: boolean;
}) => {
  const isRevealed = "rank" in card;
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setFlipped(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, reduced]);
  const showFace = isRevealed && (reduced || flipped);
  return (
    <PlayingCard
      card={isRevealed ? (card as Card) : undefined}
      faceDown={!showFace}
      className="w-16 aspect-[5/7]"
    />
  );
};

export const GameEndScreen = ({
  players,
  winnerIds,
  localPlayerId,
  onPlayAgain,
  onLeave,
}: GameEndScreenProps) => {
  const winners = players.filter((p) => winnerIds.includes(p.id));
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const isGameMaster = useUISelector(selectIsGameMaster);
  const reduced = !!useReducedMotion();

  const callerId = useUISelector(selectCheckCallerId);
  const caller = callerId ? players.find((p) => p.id === callerId) : null;
  const callerLine = caller
    ? winnerIds.includes(caller.id)
      ? `${caller.name} called Check — and it held.`
      : `${caller.name} called Check — it didn't hold.`
    : "The round ended without a Check.";

  // One-shot recap from the accumulated log (append-only; merged in the
  // machine). Counted once on mount — no new entries can land post-scoring.
  // Late joiners hold only a log tail, so counts can undercount for them.
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

  const title =
    winners.length === 0
      ? "Round Over!"
      : `${winners.map((w) => w.name).join(" & ")} Win${winners.length === 1 ? "s" : ""}!`;

  return (
    <motion.div
      className="absolute inset-0 bg-ground flex items-center justify-center z-50 p-4 font-game overflow-y-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="w-full max-w-3xl p-8 flex flex-col items-center gap-6">
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center gap-2 text-center"
        >
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-ink">
            {title}
          </h1>
          {winners.length > 0 && (
            <motion.div
              className="mt-1 h-1 rounded-full bg-accent"
              style={{ originX: 0, width: "clamp(5rem, 45%, 14rem)" }}
              initial={{ scaleX: reduced ? 1 : 0 }}
              animate={{ scaleX: 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.5 }
              }
            />
          )}
          <p className="text-lg text-ink-muted">{callerLine}</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="w-full flex flex-col gap-4"
        >
          {sortedPlayers.map((player, playerIndex) => (
            <motion.div
              key={player.id}
              variants={itemVariants}
              className={cn(
                "p-4 rounded-2xl transition-all duration-300 flex flex-col md:flex-row md:items-center gap-4",
                winnerIds.includes(player.id)
                  ? "bg-surface border-2 border-accent"
                  : "bg-surface border border-hairline",
              )}
            >
              <div className="flex-shrink-0 flex justify-between items-center md:flex-col md:w-32 md:items-start">
                <div className="flex items-center gap-2 font-bold text-xl text-ink">
                  {winnerIds.includes(player.id) && (
                    <Crown className="w-6 h-6 text-accent" />
                  )}
                  <span
                    className={cn(
                      "truncate max-w-[120px]",
                      player.status === PlayerStatus.DISQUALIFIED &&
                        "text-ink-muted line-through",
                    )}
                  >
                    {player.name}{" "}
                    {player.id === localPlayerId && (
                      <span className="text-sm font-normal text-ink-muted">
                        (You)
                      </span>
                    )}
                  </span>
                  {player.status === PlayerStatus.DISQUALIFIED && (
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted border border-hairline bg-surface rounded-full px-2 py-0.5">
                      Disqualified
                    </span>
                  )}
                </div>
                {recap.matches[player.id] || recap.penalties[player.id] ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    {recap.matches[player.id] ? (
                      <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[0.65rem] font-semibold text-ink-muted">
                        {recap.matches[player.id]} match
                        {recap.matches[player.id]! > 1 ? "es" : ""}
                      </span>
                    ) : null}
                    {recap.penalties[player.id] ? (
                      <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[0.65rem] font-semibold text-ink-muted">
                        {recap.penalties[player.id]}{" "}
                        {recap.penalties[player.id]! > 1
                          ? "penalties"
                          : "penalty"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-extrabold text-accent">
                    <CountUp value={player.score} reduced={reduced} />
                  </span>
                  <span className="text-xs font-normal text-ink-muted">
                    Points
                  </span>
                </div>
              </div>

              <div className="flex-grow border-t border-hairline md:border-t-0 md:border-l md:pl-4">
                <div className="flex items-center justify-center overflow-x-auto gap-2 pt-4 md:pt-0 pb-2">
                  {player.hand.map((card, cardIndex) => (
                    <RevealCard
                      key={card.id}
                      card={card}
                      delayMs={playerIndex * 180 + cardIndex * 60}
                      reduced={reduced}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center gap-3"
        >
          {isGameMaster && (
            <Button
              onClick={onPlayAgain}
              size="lg"
              className="rounded-full px-8 py-6 text-lg bg-accent text-accent-ink hover:bg-accent/90"
            >
              Play Again
            </Button>
          )}
          {/* Non-masters previously had no way off this screen at all (a
              forfeit can even leave the winner without a Play Again). */}
          <button
            onClick={onLeave}
            className="rounded-full border border-hairline bg-surface px-5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
          >
            Back to Home
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
