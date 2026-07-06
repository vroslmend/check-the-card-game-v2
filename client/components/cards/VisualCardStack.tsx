"use client";

import React from "react";
import { type Card, PublicCard } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useDevice } from "@/context/DeviceContext";
import { cardTravelTransition } from "@/lib/card-motion";
import { Lock } from "lucide-react";

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
  className,
}: VisualCardStackProps) => {
  const hasCards = count > 0;
  const { isTouchDevice } = useDevice();

  return (
    <div className="flex flex-col items-center">
      <motion.div
        layout
        aria-label={`${title}${count ? ` (${count})` : ""}`}
        whileHover={
          canInteract && !isTouchDevice ? { scale: 1.05, y: -5 } : undefined
        }
        // Hover keeps its spring; layout shifts ride the shared card-travel
        // tween so the base, lock overlay, ring and top card move as one
        // instead of the top card trailing the rest.
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 20,
          ...cardTravelTransition,
        }}
        onClick={onClick}
        className={cn(
          "relative w-[min(8vh,15vw)] aspect-[5/7] rounded-card",
          // Interactivity reads as a hairline accent ring + the hover lift —
          // no glow blur.
          canInteract
            ? "cursor-pointer ring-[1.5px] ring-accent"
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
        {isSealed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-ink/35">
            <Lock className="h-[26%] w-[26%] text-accent-ink" strokeWidth={2.5} />
          </div>
        )}
      </motion.div>
    </div>
  );
};
