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
  const isRed = card.suit === "H" || card.suit === "D";
  const symbol = suitSymbols[card.suit] || "?";
  const rankLabel = card.rank === CardRank.Ten ? "10" : card.rank;

  // Reference layout: the card IS typography — a big rank centered over its
  // suit glyph, no mirrored corners. Red suits carry the accent, black = ink.
  return (
    <div
      className={cn(
        "relative h-full w-full rounded-card border bg-surface border-hairline",
        "flex flex-col items-center justify-center font-game @container/card",
        isRed ? "text-accent" : "text-ink",
      )}
    >
      <span className="card-rank-text font-extrabold leading-none">
        {rankLabel}
      </span>
      <span className="card-suit-glyph leading-none">{symbol}</span>
    </div>
  );
};

interface PlayingCardProps {
  card?: Card;
  onClick?: () => void;
  faceDown?: boolean;
  className?: string;
  /** Count rendered on the card back (deck stock pile). */
  backCount?: number;
}

export function PlayingCard({
  card,
  onClick,
  faceDown,
  className,
  backCount,
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
          <CardBack count={backCount} />
        </motion.div>
      </motion.div>
    </div>
  );
}
