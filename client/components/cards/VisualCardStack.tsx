"use client";

import React from "react";
import { type Card, PublicCard } from "shared-types";
import { PlayingCard, cardSizeClasses } from "./PlayingCard";
import { CardBack } from "./CardBack";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";

interface VisualCardStackProps {
  title: string;
  count: number;
  topCard?: PublicCard | null;
  faceDown?: boolean;
  canInteract?: boolean;
  onClick?: () => void;
  isSealed?: boolean;
  size?: keyof typeof cardSizeClasses;
}

export const VisualCardStack = ({
  title,
  count,
  topCard,
  faceDown = false,
  canInteract = false,
  onClick,
  isSealed = false,
  size = "xs",
}: VisualCardStackProps) => {
  const hasCards = count > 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <h4 className="font-serif font-medium text-stone-600 dark:text-stone-400 flex">
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
        whileHover={canInteract ? { scale: 1.05, y: -5 } : {}}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={onClick}
        className={cn(
          "relative",
          cardSizeClasses[size],
          canInteract ? "cursor-pointer" : "cursor-default",
        )}
      >
        <AnimatePresence>
          {hasCards && topCard ? (
            <motion.div
              layoutId={topCard.id}
              key={topCard.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              {faceDown ? (
                <PlayingCard faceDown size={size} />
              ) : "facedown" in topCard ? (
                <PlayingCard faceDown size={size} />
              ) : (
                <PlayingCard card={topCard} size={size} />
              )}
            </motion.div>
          ) : (
            <motion.div
              className="h-full w-full rounded-lg border-2 border-dashed border-stone-300 dark:border-zinc-700 bg-black/10 dark:bg-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        {isSealed && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <Lock className="text-white/80 h-8 w-8" />
          </div>
        )}
      </motion.div>
    </div>
  );
};
