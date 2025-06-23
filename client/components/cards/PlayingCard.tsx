"use client";

import { cn } from "@/lib/utils";
import type { Card } from "shared-types";
import { CardRank } from "shared-types";
import { CardBack } from "@/components/cards/CardBack";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const sizeStyleMap = {
  xxs: { tl: "text-[10px]", center: "text-2xl", padding: "p-1" },
  xs: { tl: "text-xs", center: "text-3xl", padding: "p-1" },
  sm: { tl: "text-sm", center: "text-4xl", padding: "p-2" },
  md: { tl: "text-base", center: "text-5xl", padding: "p-2" },
  lg: { tl: "text-lg", center: "text-6xl", padding: "p-2" },
} as const;

type CardSizeKey = keyof typeof sizeStyleMap;

const PlayingCardRenderer = ({
  card,
  size,
}: {
  card: Card;
  size: CardSizeKey;
}) => {
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
  const { tl: tlClass, center: centerClass, padding } = sizeStyleMap[size];
  const symbol = suitSymbols[card.suit] || "?";
  const rankLabel = card.rank === CardRank.Ten ? "10" : card.rank;

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-md border bg-white dark:bg-zinc-900 flex flex-col justify-between font-serif",
        padding,
        "border-stone-200 dark:border-zinc-700",
        colorClass,
      )}
    >
      <div className={cn("text-left", tlClass)}>
        <div className="font-bold leading-none">{rankLabel}</div>
        <div className="leading-none">{symbol}</div>
      </div>

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          centerClass,
        )}
      >
        {symbol}
      </div>

      <div className={cn("self-end rotate-180 text-left", tlClass)}>
        <div className="font-bold leading-none">{rankLabel}</div>
        <div className="leading-none">{symbol}</div>
      </div>
    </div>
  );
};

interface PlayingCardProps {
  card?: Card;
  onClick?: () => void;
  faceDown?: boolean;
  className?: string;
  canInteract?: boolean;
  size?: keyof typeof cardSizeClasses;
}

export const cardSizeClasses = {
  xxs: "h-16 w-12",
  xs: "h-22 w-16",
  sm: "h-28 w-20",
  md: "h-36 w-24",
  lg: "h-40 w-28",
};

export function PlayingCard({
  card,
  onClick,
  faceDown,
  className,
  size = "md",
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
    <div
      className={cn(cardSizeClasses[size], className, "perspective-[1000px]")}
      onClick={onClick}
    >
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
            <PlayingCardRenderer
              card={lastCardRef.current}
              size={size as CardSizeKey}
            />
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
