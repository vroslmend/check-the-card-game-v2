"use client";

import React from "react";
import { type PublicCard } from "shared-types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { DeckCard } from "./CardPile";

interface CardInPlayProps {
  card: PublicCard;
  index: number;
  isSelected?: boolean;
  isPeeking?: boolean;
  isInteractive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const CardInPlay: React.FC<CardInPlayProps> = ({
  card,
  index,
  isSelected = false,
  isPeeking = false,
  isInteractive = false,
  onClick,
  className,
}) => {
  const canSeeCardFace = () => {
    if ("facedown" in card && !isPeeking) {
      return false;
    }

    return true;
  };

  return (
    <motion.div
      whileHover={isInteractive ? { y: -10, scale: 1.05, zIndex: 10 } : {}}
      whileTap={isInteractive ? { scale: 0.98 } : {}}
      animate={isSelected ? { y: -15 } : { y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      className={cn(
        "relative transition-all duration-200",
        "w-20",
        isInteractive && "cursor-pointer",
        className,
      )}
    >
      <DeckCard
        card={card}
        isInteractive={isInteractive}
        onClick={onClick}
        className={cn(
          isPeeking && "ring-2 ring-yellow-400 dark:ring-yellow-500",
          isSelected && "ring-2 ring-blue-400 dark:ring-blue-500",
        )}
      />

      {isSelected && (
        <motion.div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-2 py-0.5 rounded-md"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Selected
        </motion.div>
      )}
    </motion.div>
  );
};
