"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { Card } from 'shared-types';
import { CardBack } from "../ui/CardBack"
import { useState, useEffect } from "react"

// This is the specific renderer for a face-up card's visuals.
const PlayingCardRenderer = ({ card, size = "lg" }: { card: Card, size?: "xs" | "sm" | "md" | "lg" }) => {
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
    xs: "w-10 h-14 p-0.5 text-xs",
    sm: "w-12 h-16 p-1 text-xs",
    md: "w-16 h-24 p-1.5 text-sm",
    lg: "w-20 h-28 p-2 text-base",
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md flex flex-col justify-between font-serif h-full w-full',
        sizeClasses[size]
      )}
    >
      {/* Top Left */}
      <div className={cn('text-left', colorClass)}>
        <div className="font-bold leading-none">{card.rank}</div>
        <div className="leading-none">{symbol}</div>
      </div>

      {/* Center Symbol */}
      <div className={cn(
        'absolute inset-0 flex items-center justify-center', 
        colorClass,
        size === 'xs' ? 'text-3xl' : size === 'sm' ? 'text-4xl' : 'text-4xl sm:text-5xl'
      )}>
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
  isHighlighted?: boolean;
  onClick?: () => void;
  canInteract?: boolean;
  layoutId?: string;
  size?: "xs" | "sm" | "md" | "lg";
  faceDown?: boolean;
  className?: string;
  position?: number;
}

export function PlayingCard({
  card,
  isSelected,
  isTarget,
  isPeeked,
  isHighlighted,
  onClick,
  canInteract = true,
  layoutId,
  faceDown,
  size = "md",
  className,
  position
}: PlayingCardProps) {
  // Track the previous face-down state to enable animations
  const [previousIsFaceDown, setPreviousIsFaceDown] = useState(faceDown);
  const [isFlipping, setIsFlipping] = useState(false);
  
  // Detect changes in faceDown to trigger flip animation
  useEffect(() => {
    if (previousIsFaceDown !== faceDown) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setIsFlipping(false);
        setPreviousIsFaceDown(faceDown);
      }, 400); // Match this with the flip animation duration
      return () => clearTimeout(timer);
    }
  }, [faceDown, previousIsFaceDown]);

  // Determine if we should show the front or back based on animation state
  const showFront = (isFlipping ? previousIsFaceDown : !faceDown) && !!card;
  
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
      y: -6,
      boxShadow: "0 12px 20px -8px rgba(0,0,0,0.2)",
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
        y: -8,
        boxShadow: "0 15px 20px rgba(0,0,0,0.15)"
      }
    : isTarget
      ? {
          y: -5,
          boxShadow: "0 12px 18px rgba(0,0,0,0.12)"
        }
      : isPeeked
        ? {
            y: -4,
            boxShadow: "0 12px 18px rgba(0,0,0,0.12)"
          }
        : isHighlighted
          ? {
              y: -3,
              boxShadow: "0 10px 15px rgba(0,0,0,0.1)"
            }
          : {
              y: 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
            };

  const sizeClasses = {
    xs: "w-10 h-14",
    sm: "w-12 h-16",
    md: "w-16 h-24",
    lg: "w-20 h-28",
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
        isSelected && "ring-1 ring-blue-500/50",
        isTarget && "ring-1 ring-amber-500/50",
        isPeeked && "ring-1 ring-green-500/50",
        isHighlighted && "ring-1 ring-yellow-500/50",
        !canInteract && "cursor-not-allowed opacity-70",
        sizeClasses[size],
        className
      )}
      onClick={canInteract ? onClick : undefined}
      data-cursor-link={canInteract}
      style={{ 
        perspective: "1000px"
      }}
    >
      <motion.div 
        className="w-full h-full relative"
        animate={{
          rotateY: showFront ? "0deg" : "180deg"
        }}
        transition={{
          duration: isFlipping ? 0.4 : 0,
          ease: "easeInOut"
        }}
        style={{ 
          transformStyle: "preserve-3d"
        }}
      >
        {/* Front of card */}
        <motion.div 
          className="absolute w-full h-full backface-hidden"
          style={{ 
            backfaceVisibility: "hidden",
            transform: showFront ? "rotateY(0deg)" : "rotateY(180deg)"
          }}
        >
          {card && <PlayingCardRenderer card={card} size={size} />}
        </motion.div>
        
        {/* Back of card */}
        <motion.div 
          className="absolute w-full h-full backface-hidden"
          style={{ 
            backfaceVisibility: "hidden",
            transform: !showFront ? "rotateY(0deg)" : "rotateY(-180deg)"
          }}
        >
          <CardBack size={size} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
} 