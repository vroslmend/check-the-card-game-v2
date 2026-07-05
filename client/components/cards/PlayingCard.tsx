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

  // 2D flip: the container sweeps scaleX 1 → -1 (through 0 at the midpoint,
  // which reads exactly like a Y-rotation edge-on) while the faces
  // opacity-swap at that midpoint — the visible face never depends on 3D
  // backface culling. No perspective / preserve-3d / backface-visibility
  // anywhere: permanent per-card 3D contexts are what Gecko composites into
  // seam-prone tiled surfaces (the Firefox/Zen hairlines), and the original
  // blank-face bug class dies with them too. The back face carries a static
  // scaleX(-1) so it reads unmirrored when the container is at -1.
  return (
    <div className={className} onClick={onClick}>
      <motion.div
        className="relative w-full h-full"
        initial={false}
        variants={{ front: { scaleX: 1 }, back: { scaleX: -1 } }}
        animate={showFront ? "front" : "back"}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute w-full h-full"
          variants={{ front: { opacity: 1 }, back: { opacity: 0 } }}
          transition={{ duration: 0, delay: 0.25 }}
        >
          {lastCardRef.current && (
            <PlayingCardRenderer card={lastCardRef.current} />
          )}
        </motion.div>

        <motion.div
          className="absolute w-full h-full"
          style={{ scaleX: -1 }}
          variants={{ front: { opacity: 0 }, back: { opacity: 1 } }}
          transition={{ duration: 0, delay: 0.25 }}
        >
          <CardBack count={backCount} />
        </motion.div>
      </motion.div>
    </div>
  );
}
