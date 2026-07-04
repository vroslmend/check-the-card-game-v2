"use client";

import React, { useEffect, useState } from "react";
import { type Player, type Card, PlayerStatus } from "shared-types";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Crown, PartyPopper } from "lucide-react";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { cn } from "@/lib/utils";
import { useUISelector } from "@/context/GameUIContext";

interface GameEndScreenProps {
  players: Player[];
  winnerIds: string[];
  localPlayerId: string;
  onPlayAgain: () => void;
}

const containerVariants = {
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

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const selectIsGameMaster = (state: any) =>
  state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

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
}: GameEndScreenProps) => {
  const winners = players.filter((p) => winnerIds.includes(p.id));
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const isGameMaster = useUISelector(selectIsGameMaster);
  const reduced = !!useReducedMotion();

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
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 12,
              delay: 0.25,
            }}
          >
            <PartyPopper className="w-16 h-16 text-accent" />
          </motion.div>
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
          <p className="text-lg text-ink-muted">Final Scores</p>
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

        {isGameMaster && (
          <motion.div variants={itemVariants}>
            <Button
              onClick={onPlayAgain}
              size="lg"
              className="rounded-full px-8 py-6 text-lg bg-accent text-accent-ink hover:bg-accent/90"
            >
              Play Again
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};
