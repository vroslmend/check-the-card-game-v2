"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Card } from 'shared-types';
import { CardBack } from "../ui/CardBack"

// This is the specific renderer for a face-up card's visuals.
// It was previously in BasicCardRenderer.tsx
const PlayingCardRenderer = ({ card }: { card: Card }) => {
  const suitSymbols: Record<string, string> = {
    H: '♥', D: '♦', C: '♣', S: '♠',
  };
  const suitColors: Record<string, string> = {
    H: 'text-red-500', D: 'text-red-500',
    C: 'text-black', S: 'text-black',
  };

  const colorClass = suitColors[card.suit] || 'text-black';
  const symbol = suitSymbols[card.suit] || '?';

  return (
    <div
      className={cn(
        'relative w-32 h-48 rounded-lg border bg-white shadow-md p-2 flex flex-col justify-between font-serif'
      )}
    >
      {/* Top Left */}
      <div className={cn('text-left', colorClass)}>
        <div className="text-xl font-bold">{card.rank}</div>
        <div className="text-lg leading-none">{symbol}</div>
      </div>

      {/* Center Symbol */}
      <div className={cn('absolute inset-0 flex items-center justify-center text-6xl', colorClass)}>
        {symbol}
      </div>

      {/* Bottom Right (Rotated) */}
      <div className={cn('self-end rotate-180 text-left', colorClass)}>
        <div className="text-xl font-bold">{card.rank}</div>
        <div className="text-lg leading-none">{symbol}</div>
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
  canInteract,
  layoutId,
  isFaceDown,
  size,
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

  return (
    <motion.div
      layoutId={layoutId}
       whileHover={
        canInteract
          ? {
              y: -4,
              scale: 1.02,
              transition: { duration: 0.2 },
            }
          : {}
      }
      whileTap={canInteract ? { scale: 0.98 } : {}}
      animate={
        isSelected || isTarget
          ? {
              y: -4,
              boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
            }
          : {
              y: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }
      }
      className={cn(className, "cursor-pointer")}
      onClick={onClick}
    >
        <PlayingCardRenderer card={card} />
    </motion.div>
  )
} 