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
  label?: string;
  className?: string;
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
  label,
  className 
}: DeckCardProps) => {
  return (
    <div className={cn("relative h-48 w-32", className)}>
      {/* Stack effect for decks with multiple cards */}
      {count && count > 1 && (
        <>
          <motion.div 
            className="absolute h-48 w-32 top-2 left-2 z-0"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardBack size="lg" canInteract={false} />
          </motion.div>
          {count > 2 && (
            <motion.div 
              className="absolute h-48 w-32 top-1 left-1 z-0"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <CardBack size="lg" canInteract={false} />
            </motion.div>
          )}
        </>
      )}

      {/* Main card */}
      <motion.div 
        className="relative z-10"
        whileHover={isInteractive ? { y: -8, transition: { duration: 0.2 } } : {}}
        onClick={isInteractive ? onClick : undefined}
        data-cursor-link={isInteractive}
      >
        <AnimatePresence mode="wait">
          {isFaceUpCard(card) ? (
            <PlayingCard key="face-up" card={card} canInteract={isInteractive} onClick={onClick} />
          ) : (
            <CardBack key="face-down" size="lg" canInteract={isInteractive} onClick={onClick} />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Count indicator */}
      {count !== undefined && count > 0 && (
        <motion.div 
          className="absolute -bottom-3 -right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
        >
          <span className="text-xs font-bold">{count}</span>
        </motion.div>
      )}

      {/* Label */}
      {label && (
        <motion.div 
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-center"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="text-sm font-light text-stone-600 dark:text-stone-400">{label}</span>
        </motion.div>
      )}
    </div>
  );
}; 