"use client";

import { cn } from "@/lib/utils";
import type { Card } from "shared-types";
import { CardRank } from "shared-types";
import { CardBack } from "@/components/cards/CardBack";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const PlayingCardRenderer = ({ card }: { card: Card }) => {
  const suitSymbols: Record<string, string> = {
    H: "♥",
    D: "♦",
    C: "♣",
    S: "♠",
  };
  const suitColors: Record<string, string> = {
    H: "text-rose-600 dark:text-rose-400",
    D: "text-rose-600 dark:text-rose-400",
    C: "text-stone-800 dark:text-stone-300",
    S: "text-stone-800 dark:text-stone-300",
  };

  const colorClass =
    suitColors[card.suit] || "text-stone-800 dark:text-stone-300";
  const symbol = suitSymbols[card.suit] || "?";
  const rankLabel = card.rank === CardRank.Ten ? "10" : card.rank;

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-lg border bg-white dark:bg-zinc-900 flex flex-col justify-between font-serif p-1 @container/card",
        "border-stone-200 dark:border-zinc-700",
        colorClass,
      )}
    >
      <div className="text-left card-corner-text">
        <div className="font-bold leading-none">{rankLabel}</div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center card-suit-text">
        {symbol}
      </div>

      <div className="self-end rotate-180 text-left card-corner-text">
        <div className="font-bold leading-none">{rankLabel}</div>
      </div>
    </div>
  );
};

interface PlayingCardProps {
  card?: Card;
  onClick?: () => void;
  faceDown?: boolean;
  className?: string;
}

export function PlayingCard({
  card,
  onClick,
  faceDown,
  className,
}: PlayingCardProps) {
  const showFront = !faceDown;

  const lastCardRef = useRef<Card | undefined>(card);
  useEffect(() => {
    if (card) lastCardRef.current = card;
  }, [card]);

  // The front face is untransformed at rest (parent rotateY(0) renders as
  // `transform: none`). Firefox fails to paint text inside the previous
  // structure (front face pre-rotated 180° under a 180°-rotated preserve-3d
  // parent with backface-visibility: hidden), which left card faces blank.
  // The mid-flip opacity swap makes the visible face explicit, so nothing
  // depends on backface culling being computed correctly at exactly 180°.
  return (
    <div className={cn("perspective-[1000px]", className)} onClick={onClick}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        variants={{ front: { rotateY: 0 }, back: { rotateY: 180 } }}
        animate={showFront ? "front" : "back"}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute w-full h-full"
          style={{ backfaceVisibility: "hidden" }}
          variants={{ front: { opacity: 1 }, back: { opacity: 0 } }}
          transition={{ duration: 0, delay: 0.25 }}
        >
          {lastCardRef.current && (
            <PlayingCardRenderer card={lastCardRef.current} />
          )}
        </motion.div>

        <motion.div
          className="absolute w-full h-full"
          style={{ rotateY: 180, backfaceVisibility: "hidden" }}
          variants={{ front: { opacity: 0 }, back: { opacity: 1 } }}
          transition={{ duration: 0, delay: 0.25 }}
        >
          <CardBack />
        </motion.div>
      </motion.div>
    </div>
  );
}
