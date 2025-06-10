"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Card } from 'shared-types';
import { CardBack } from "../ui/CardBack"

// This is the specific renderer for a face-up card's visuals.
const PlayingCardRenderer = ({ card, size = "lg" }: { card: Card, size?: "sm" | "md" | "lg" }) => {
  const suitSymbols: Record<string, string> = {
    H: '♥', D: '♦', C: '♣', S: '♠',
  };
  const suitColors: Record<string, string> = {
    H: 'text-red-500 dark:text-red-400', D: 'text-red-500 dark:text-red-400',
    C: 'text-stone-900 dark:text-stone-100', S: 'text-stone-900 dark:text-stone-100',
  };

  const colorClass = suitColors[card.suit] || 'text-stone-900 dark:text-stone-100';
  const symbol = suitSymbols[card.suit] || '?';
  
  const sizeClasses = {
    sm: "w-12 h-16 p-1 text-xs",
    md: "w-16 h-24 p-1.5 text-sm",
    lg: "w-20 h-28 p-2 text-base",
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md flex flex-col justify-between font-serif',
        sizeClasses[size]
      )}
    >
      {/* Top Left */}
      <div className={cn('text-left', colorClass)}>
        <div className="font-bold leading-none">{card.rank}</div>
        <div className="leading-none">{symbol}</div>
      </div>

      {/* Center Symbol */}
      <div className={cn('absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl', colorClass)}>
        {symbol}
      </div>

      {/* Bottom Right (Rotated) */}
      <div className={cn('self-end rotate-180 text-left', colorClass)}>
        <div className="font-bold leading-none">{card.rank}</div>
        <div className="leading-none">{symbol}</div>
      </div>
    </div>
  )
}

interface PlayingCardProps {
  card?: Card;
  isSelected?: boolean;
  isTarget?: boolean;
  isPeeked?: boolean;
  onClick?: () => void;
  canInteract?: boolean;
  layoutId?: string;
  size?: "sm" | "md" | "lg";
  isFaceDown?: boolean;
  className?: string;
  position?: number;
}

export function PlayingCard({
  card,
  isSelected,
  isTarget,
  isPeeked,
  onClick,
  canInteract = true,
  layoutId,
  isFaceDown,
  size = "md",
  className,
  position
}: PlayingCardProps) {

  if (isFaceDown || !card) {
    return (
      <CardBack
        layoutId={layoutId}
        size={size}
        onClick={onClick}
        canInteract={canInteract}
        isSelected={isSelected}
        isTarget={isTarget}
        isPeeked={isPeeked}
        position={position}
      />
    )
  }

  const springConfig = { type: "spring", stiffness: 400, damping: 25 };
  
  // Define animation variants
  const variants = {
    initial: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95 
    },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.3,
        ...springConfig 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.95,
      transition: { 
        duration: 0.2 
      }
    },
    hover: canInteract ? {
      y: -8,
      boxShadow: "0 15px 30px -10px rgba(0,0,0,0.2)",
      transition: { 
        duration: 0.2 
      }
    } : {},
    tap: canInteract ? { 
      scale: 0.98 
    } : {}
  };
  
  // Animation states based on selection state
  const animationState = isSelected 
    ? {
        y: -10,
        boxShadow: "0 20px 25px rgba(0,0,0,0.15)"
      }
    : isTarget
      ? {
          y: -6,
          boxShadow: "0 15px 20px rgba(0,0,0,0.12)"
        }
      : {
          y: 0,
          boxShadow: "0 5px 15px rgba(0,0,0,0.08)"
        };

  return (
    <motion.div
      layoutId={layoutId}
      variants={variants}
      initial="initial"
      animate={{
        ...variants.animate,
        ...animationState
      }}
      exit="exit"
      whileHover="hover"
      whileTap="tap"
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-blue-500/50",
        isTarget && "ring-2 ring-amber-500/50",
        !canInteract && "cursor-not-allowed opacity-70",
        className
      )}
      onClick={canInteract ? onClick : undefined}
      data-cursor-link={canInteract}
    >
      <PlayingCardRenderer card={card} size={size} />
      
      {/* Highlight for selected/target states */}
      {(isSelected || isTarget) && (
        <motion.div
          layoutId={`${layoutId}-glow`}
          className={cn(
            "absolute inset-0 rounded-xl -z-10 opacity-75",
            isSelected ? "bg-blue-500/10" : "bg-amber-500/10"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          exit={{ opacity: 0 }}
        />
      )}
    </motion.div>
  )
} 