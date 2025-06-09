import React, { useState } from 'react';
import { ClientCard, Card } from 'shared-types';
import { CardDisplay } from '../ui/CardDisplay';
import { AnimatePresence, motion } from 'framer-motion';

interface PlayerHandProps {
  hand: ClientCard[];
  onCardClick: (card: ClientCard, index: number) => void;
  localPlayerId: string;
  isPeeking?: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ hand, onCardClick, localPlayerId, isPeeking = false }) => {
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  const handleCardClick = (card: ClientCard, index: number) => {
    if (isPeeking) return;
    onCardClick(card, index);
  };

  return (
    <div className="flex justify-center items-center space-x-2 p-4 min-h-[150px]">
      <AnimatePresence>
        {hand.length > 0 ? (
          hand.map((card, index) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.3 }}
              onClick={() => handleCardClick(card, index)}
              onMouseEnter={() => isPeeking && setRevealedIndex(index)}
              onMouseLeave={() => isPeeking && setRevealedIndex(null)}
              className={!isPeeking ? 'cursor-pointer' : ''}
            >
              <CardDisplay
                card={(card as Card).suit ? (card as Card) : undefined}
                isFaceDown={isPeeking && revealedIndex !== index}
              />
            </motion.div>
          ))
        ) : (
          <p className="text-muted-foreground">No cards in hand.</p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlayerHand;