"use client";

import React from "react";
import { type Card, PublicCard } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { cardTravelTransition } from "@/lib/card-motion";
import { Equal, Lock } from "lucide-react";

interface VisualCardStackProps {
  title: string;
  count: number;
  topCard?: PublicCard | null;
  /** Card revealed underneath when the top card animates away. */
  secondCard?: PublicCard | null;
  faceDown?: boolean;
  canInteract?: boolean;
  onClick?: () => void;
  isSealed?: boolean;
  /** A matching window is open on this pile's top card. */
  isMatchTarget?: boolean;
  className?: string;
}

export const VisualCardStack = ({
  title,
  count,
  topCard,
  secondCard = null,
  faceDown = false,
  canInteract = false,
  onClick,
  isSealed = false,
  isMatchTarget = false,
  className,
}: VisualCardStackProps) => {
  const hasCards = count > 0;

  return (
    <div className="flex flex-col items-center">
      <motion.div
        layout
        aria-label={`${title}${count ? ` (${count})` : ""}`}
        // No transform poses on this element: it is a projection node
        // (layout), and a hover spring fighting the projection for the same
        // transform is what intermittently skipped flights and stranded
        // hover poses on Gecko (Zen/Firefox). The interactive cue is the
        // accent ring plus a CSS brightness lift — hover: is hover-capable
        // gated by Tailwind v4, so touch devices never stick.
        transition={cardTravelTransition}
        onClick={onClick}
        className={cn(
          "relative w-[min(8vh,15vw)] aspect-[5/7] rounded-card",
          canInteract
            ? "cursor-pointer ring-[1.5px] ring-accent transition-[filter] hover:brightness-110"
            : "cursor-default",
          className,
        )}
      >
        {/* A static card under the animated top card keeps the pile visually
            stable while the top card flies away or a new one lands. */}
        {count > 1 && (
          <div className="absolute inset-0 z-[5]" aria-hidden>
            {!faceDown && secondCard && "rank" in secondCard ? (
              <PlayingCard card={secondCard} className="h-full w-full" />
            ) : (
              <PlayingCard faceDown className="h-full w-full" />
            )}
          </div>
        )}
        {/* No enter/exit poses on the layoutId element: a departing top card
            unmounts instantly (the static under-card keeps the pile visually
            whole — that is its job) and its layoutId is picked up by the
            drawn slot / hand in the same commit for a clean flight; a landing
            card flies in from wherever its layoutId last was. */}
        {hasCards && topCard ? (
          <motion.div
            layoutId={topCard.id}
            key={topCard.id}
            className="absolute inset-0 z-10"
            transition={cardTravelTransition}
          >
            {faceDown ? (
              // The stock pile shows its count on the top card's back.
              <PlayingCard
                faceDown
                backCount={count}
                className="h-full w-full"
              />
            ) : "facedown" in topCard ? (
              <PlayingCard faceDown className="h-full w-full" />
            ) : (
              <PlayingCard card={topCard} className="h-full w-full" />
            )}
          </motion.div>
        ) : (
          <motion.div
            className="relative z-10 h-full w-full rounded-card border border-hairline bg-ink/[0.04]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
        {/* Sealed = "can't be drawn this turn" (a K/Q/J was just discarded).
            A corner chip in the SlotBadge vocabulary says "restricted"
            without covering the face — the old full-card scrim hid the rank
            at the exact moment a matching window on it opened. */}
        {isSealed && (
          <span
            aria-label="Sealed: can't be drawn this turn"
            className="absolute -top-2 -right-2 z-20 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
          >
            <Lock className="h-3 w-3" strokeWidth={2.5} />
          </span>
        )}
        {/* Matching window open: a corner chip in the SlotBadge vocabulary
            (the MATCH? center splash it replaces took over the scene to say
            something every player already knows). Top-LEFT — a discarded
            K/Q/J opens a window AND seals the pile, and the seal owns the
            right corner. */}
        {isMatchTarget && (
          <span
            aria-label="Matching window open"
            className="absolute -top-2 -left-2 z-20 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
          >
            <Equal className="h-3 w-3" strokeWidth={2.5} />
          </span>
        )}
      </motion.div>
    </div>
  );
};
