import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Card } from "shared-types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface VisualCardStackProps {
  title?: string;
  topCard?: Card | null;
  cards?: Card[];
  count: number;
  faceDown?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  isSealed?: boolean;
  canInteract?: boolean;
  onClick?: () => void;
  className?: string;
}

export const VisualCardStack: React.FC<VisualCardStackProps> = ({
  title,
  topCard,
  cards = [],
  count,
  faceDown = false,
  size = "md",
  isSealed = false,
  canInteract = false,
  onClick,
  className
}) => {
  // Determine how many cards to show in the stack 
  // (the rest will just be represented by the count)
  const maxVisibleCards = 5;
  const visibleCards = cards.slice(Math.max(0, cards.length - maxVisibleCards));
  
  return (
    <div className={cn(
      "flex flex-col items-center gap-2",
      className
    )}>
      {/* Stack title */}
      {title && (
        <span className="text-sm text-stone-600 dark:text-stone-400 font-serif">
          {title}
        </span>
      )}
      
      {/* Card stack */}
      <div 
        className={cn(
          "relative",
          canInteract && "cursor-pointer"
        )}
        onClick={canInteract ? onClick : undefined}
      >
        <AnimatePresence>
          {canInteract && (
            <motion.div
              className="absolute -inset-2 rounded-lg bg-emerald-500/20 blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
        <motion.div
          whileHover={canInteract ? { scale: 1.05, y: -2 } : {}}
          className="relative"
        >
          {/* Base card */}
          <PlayingCard
            size={size}
            faceDown={faceDown || !topCard}
            card={topCard || undefined}
            className={cn(
              "shadow-lg border border-stone-200 dark:border-zinc-700",
              canInteract && "hover:shadow-xl"
            )}
          />
          
          {/* Card count badge */}
          {count > 0 && (
            <motion.div
              className="absolute -top-2 -right-2 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 w-6 h-6 rounded-full text-xs font-semibold shadow-md flex items-center justify-center border-2 border-white dark:border-zinc-900"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {count}
            </motion.div>
          )}
          
          {/* Sealed indicator */}
          {isSealed && (
            <motion.div
              className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5 border-2 border-white dark:border-zinc-900"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Lock className="w-3 h-3" />
              <span>Sealed</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}; 