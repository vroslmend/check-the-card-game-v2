"use client";

import React from "react";
import { type Card, PublicCard } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { CardBack } from "./CardBack";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useDevice } from "@/context/DeviceContext";
import { cardTravelTransition } from "@/lib/card-motion";

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
    <div className="flex flex-col items-center gap-2">
      <h4 className="font-game font-medium text-stone-600 dark:text-stone-400 flex text-[clamp(0.875rem,2.5vw,1rem)]">
        {title} (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={count}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="inline-block"
          >
            {count}
          </motion.span>
        </AnimatePresence>
        )
      </h4>
      <motion.div
        whileHover={
          canInteract && !isTouchDevice ? { scale: 1.05, y: -5 } : undefined
        }
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={onClick}
        className={cn(
          "relative w-[min(8vh,15vw)] aspect-[5/7]",
          canInteract ? "cursor-pointer" : "cursor-default",
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
        <AnimatePresence>
          {hasCards && topCard ? (
            <motion.div
              layoutId={topCard.id}
              key={topCard.id}
              className="absolute inset-0 z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ...cardTravelTransition }}
            >
              {faceDown ? (
                <PlayingCard faceDown className="h-full w-full" />
              ) : "facedown" in topCard ? (
                <PlayingCard faceDown className="h-full w-full" />
              ) : (
                <PlayingCard card={topCard} className="h-full w-full" />
              )}
            </motion.div>
          ) : (
            <motion.div
              className="relative z-10 h-full w-full rounded-lg border-2 border-dashed border-stone-300 dark:border-zinc-700 bg-black/10 dark:bg-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        {isSealed && (
          <div className="absolute inset-0 rounded-lg z-20 bg-black/40 grayscale" />
        )}
        {canInteract && (
          <motion.div
            className="absolute -inset-2 rounded-lg bg-blue-500/50 blur-lg z-0"
            layoutId={`interactive-glow-${title}`}
          />
        )}
      </motion.div>
    </div>
  );
};
