"use client";

import React, { useEffect, useRef, useState } from "react";
import { type Card, PublicCard } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
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

  // The seal/match chips key off broadcast state that arrives when the
  // discarded card BEGINS its 0.65s flight — they used to appear on the pile
  // before the card did. Track the top card's layout animation (same
  // start/complete + backstop pattern as CardFlight; Gecko can drop the
  // completion callback on interrupted flights).
  const [topInFlight, setTopInFlight] = useState(false);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearRef.current) clearTimeout(clearRef.current);
    },
    [],
  );
  const flightOn = () => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setTopInFlight(true);
    clearRef.current = setTimeout(() => setTopInFlight(false), 900);
  };
  const flightOff = () => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setTopInFlight(false);
  };

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
          "relative w-(--card-w) aspect-[5/7] rounded-card",
          canInteract
            ? "cursor-pointer transition-[filter] hover:brightness-110"
            : "cursor-default",
          className,
        )}
      >
        {/* Highlight as an inset accent border drawn OVER the stacked cards
            rather than an outer ring: an outer ring left the card's own
            hairline border visible as a gray seam between the ring and the
            white face in light mode. Coplanar with (and above) that border,
            this hugs the face cleanly and renders crisp at the corners. */}
        {canInteract && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[15] rounded-card border-2 border-accent"
          />
        )}
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
            onLayoutAnimationStart={flightOn}
            onLayoutAnimationComplete={flightOff}
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
        {/* Chips wait for the card to land (topInFlight). Sealed = "can't be
            DRAWN this turn" — but while the matching window is open the pile
            IS matchable, and a lock over an active match affordance read as a
            contradiction. The seal surfaces when the window closes, exactly
            when the next player faces the draw decision. */}
        <AnimatePresence>
          {isSealed && !isMatchTarget && !topInFlight && (
            <motion.span
              key="seal"
              aria-label="Sealed: can't be drawn this turn"
              className="absolute -top-2 -right-2 z-20 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Lock className="h-3 w-3" strokeWidth={2.5} />
            </motion.span>
          )}
          {isMatchTarget && !topInFlight && (
            <motion.span
              key="match"
              aria-label="Matching window open"
              className="absolute -top-2 -left-2 z-20 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Equal className="h-3 w-3" strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
