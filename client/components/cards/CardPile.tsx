'use client';

import React from 'react';
import { Card as CardType } from 'shared-types';
import { PlayingCard } from './PlayingCard';
import { CardBack } from '../ui/CardBack';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type DeckCardProps = {
  card?: CardType | { facedown: true } | null;
  count?: number;
  isInteractive?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

// Type guard to check if a card is a face-up card
function isFaceUpCard(card: DeckCardProps['card']): card is CardType {
  return !!card && 'suit' in card;
}

// A generic component to represent a card on the table, which could be
// the deck, the discard pile, or another player's card.
export const DeckCard = ({ 
  card, 
  count, 
  isInteractive = false, 
  onClick, 
  className,
  size = 'md'
}: DeckCardProps) => {
  // Determine size classes based on the size prop
  const sizeClasses = {
    xs: "h-22 w-16",
    sm: "h-26 w-18",
    md: "h-32 w-24",
    lg: "h-40 w-28"
  };

  // Calculate stack offset based on size
  const stackOffset = {
    xs: 0.5,
    sm: 0.7,
    md: 1,
    lg: 1.5
  }[size];

  const cardSizeClass = sizeClasses[size];
  
  return (
    <div className={cn("relative", cardSizeClass, className)}>
      {/* Stack effect for decks with multiple cards */}
      {count && count > 1 && (
        <>
          <motion.div 
            className={cn("absolute z-0", cardSizeClass)}
            style={{ top: `${stackOffset}rem`, left: `${stackOffset}rem` }}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardBack size={size} canInteract={false} />
          </motion.div>
          {count > 2 && (
            <motion.div 
              className={cn("absolute z-0", cardSizeClass)}
              style={{ top: `${stackOffset/2}rem`, left: `${stackOffset/2}rem` }}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <CardBack size={size} canInteract={false} />
            </motion.div>
          )}
        </>
      )}

      {/* Main card */}
      <motion.div 
        className="relative z-10"
        whileHover={isInteractive ? { y: -4, transition: { duration: 0.2 } } : {}}
        onClick={isInteractive ? onClick : undefined}
        data-cursor-link={isInteractive}
      >
        <AnimatePresence mode="wait">
          {isFaceUpCard(card) ? (
            <PlayingCard key="face-up" card={card} canInteract={isInteractive} onClick={onClick} size={size} />
          ) : (
            <CardBack key="face-down" size={size} canInteract={isInteractive} onClick={onClick} />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Count indicator */}
      {count !== undefined && count > 0 && (
        <motion.div 
          className={cn(
            "absolute -bottom-1.5 -right-1.5 z-20 flex items-center justify-center rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm",
            size === 'xs' ? "h-4 w-4" : size === 'sm' ? "h-5 w-5" : "h-6 w-6"
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
        >
          <span className={cn(
            "font-medium",
            size === 'xs' ? "text-[8px]" : size === 'sm' ? "text-[10px]" : "text-xs"
          )}>
            {count}
          </span>
        </motion.div>
      )}
    </div>
  );
}; 