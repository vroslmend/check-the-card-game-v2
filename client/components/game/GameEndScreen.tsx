"use client";

import React from "react";
import { type Player, type Card, PlayerStatus } from "shared-types";
import { motion } from "framer-motion";
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

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 200, damping: 20 },
  },
};

const selectIsGameMaster = (state: any) =>
  state.context.currentGameState?.gameMasterId === state.context.localPlayerId;

export const GameEndScreen = ({
  players,
  winnerIds,
  localPlayerId,
  onPlayAgain,
}: GameEndScreenProps) => {
  const winners = players.filter((p) => winnerIds.includes(p.id));
  const sortedPlayers = [...players].sort((a, b) => a.score - b.score);
  const isGameMaster = useUISelector(selectIsGameMaster);

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
          <p className="text-lg text-ink-muted">Final Scores</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="w-full flex flex-col gap-4"
        >
          {sortedPlayers.map((player) => (
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
                    {player.score}
                  </span>
                  <span className="text-xs font-normal text-ink-muted">
                    Points
                  </span>
                </div>
              </div>

              <div className="flex-grow border-t border-hairline md:border-t-0 md:border-l md:pl-4">
                <motion.div
                  className="flex items-center justify-center overflow-x-auto gap-2 pt-4 md:pt-0 pb-2"
                  variants={cardContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {player.hand.map((card) => {
                    const isRevealed = "rank" in card;
                    return (
                      <motion.div key={card.id} variants={cardItemVariants}>
                        <PlayingCard
                          card={isRevealed ? (card as Card) : undefined}
                          faceDown={!isRevealed}
                          className="w-16 aspect-[5/7]"
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
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
