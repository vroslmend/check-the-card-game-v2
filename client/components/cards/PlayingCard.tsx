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
      <div className={cn("text-left text-[clamp(0.875rem,40cqw,1.25rem)]")}>
        <div className="font-bold leading-none">{rankLabel}</div>
      </div>

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[clamp(0.875rem,20cqw,3rem)]",
        )}
      >
        {symbol}
      </div>

      <div
        className={cn(
          "self-end rotate-180 text-left text-[clamp(0.875rem,40cqw,1.25rem)]",
        )}
      >
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

  const variants = {
    flipped: { rotateY: 180 },
    unflipped: { rotateY: 0 },
  };

  return (
    <div className={cn("perspective-[1000px]", className)} onClick={onClick}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        variants={variants}
        animate={showFront ? "flipped" : "unflipped"}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <div
          className="absolute w-full h-full"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {lastCardRef.current && (
            <PlayingCardRenderer card={lastCardRef.current} />
          )}
        </div>

        <div
          className="absolute w-full h-full"
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardBack />
        </div>
      </motion.div>
    </div>
  );
}
