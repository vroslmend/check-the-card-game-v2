'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { PlayingCard } from '../cards/PlayingCard';
import { Button } from '../ui/button';
import type { Card } from 'shared-types';
import { ArrowDown, CornerDownLeft, Trash2 } from 'lucide-react';

interface DrawnCardAreaProps {
  card: Card;
  onSwap: () => void;
  onDiscard: () => void;
  canDiscard: boolean;
}

export const DrawnCardArea = ({ card, onSwap, onDiscard, canDiscard }: DrawnCardAreaProps) => {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4 pointer-events-none"
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg p-6 rounded-3xl shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col items-center gap-6 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-xl font-light text-stone-800 dark:text-stone-200">You drew a card</h3>
            <p className="text-center text-sm text-stone-500">Choose an action</p>
          </motion.div>

          <PlayingCard card={card} size="lg" />

          <div className="flex gap-4">
            <Button onClick={onSwap} size="lg" className="group">
              <CornerDownLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Swap with card in hand
            </Button>
            {canDiscard && (
              <Button onClick={onDiscard} variant="secondary" size="lg" className="group">
                <Trash2 className="h-4 w-4 mr-2 transition-transform group-hover:scale-110" />
                Discard
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}; 