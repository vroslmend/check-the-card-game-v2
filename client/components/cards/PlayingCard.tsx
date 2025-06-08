'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Card } from 'shared-types';

interface PlayingCardProps {
  card: Card;
  className?: string;
  layoutId?: string;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
};

export function PlayingCard({ card, className, layoutId }: PlayingCardProps) {
  const colorClass = suitColors[card.suit.toLowerCase()] || 'text-black';
  const symbol = suitSymbols[card.suit.toLowerCase()] || '?';

  return (
    <motion.div
      layoutId={layoutId}
      className={cn(
        'relative w-32 h-48 rounded-lg border bg-white shadow-md p-2 flex flex-col justify-between font-serif',
        className
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
    </motion.div>
  );
} 