import React from 'react';
import type { Card } from 'shared-types';
import CardComponent from './CardComponent';
import { motion, AnimatePresence } from 'motion/react';

interface DiscardPileComponentProps {
  topCard: Card | null;
  onClick?: () => void;
  canDraw: boolean;
  isSealed: boolean;
  numberOfCards: number;
}

const DiscardPileComponent: React.FC<DiscardPileComponentProps> = ({
  topCard,
  onClick,
  canDraw,
  isSealed,
  numberOfCards
}) => {
  const cardWidth = "w-12 md:w-14";
  const cardAspectRatio = "aspect-[2.5/3.5]";
  const effectiveCanDraw = canDraw && !isSealed;

  const pileVisualContent = (
    <div className={`relative ${cardWidth} ${cardAspectRatio} mx-auto`}>
      {topCard && numberOfCards > 1 && (
        <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-md transform translate-x-0.5 translate-y-0.5 pointer-events-none`} />
      )}
      {topCard && numberOfCards > 2 && (
        <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-sm transform translate-x-1 translate-y-1 pointer-events-none opacity-75`} />
      )}
      {topCard && numberOfCards > 3 && (
        <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-xs transform translate-x-[1.5px] translate-y-[1.5px] pointer-events-none opacity-50`} />
      )}
      
      <AnimatePresence mode='wait'>
        {topCard ? (
          <motion.div
            key={topCard.id || `${topCard.rank}-${topCard.suit}`}
            initial={{ opacity: 0, scale: 0.7, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full h-full absolute inset-0 z-10"
          >
            <CardComponent
              card={topCard}
              isFaceUp={true}
              isInteractive={false}
              disableHoverEffect={true}
            />
            <AnimatePresence>
              {isSealed && (
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md md:rounded-lg p-2 pointer-events-none"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="empty-discard-placeholder"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full absolute inset-0 rounded-md md:rounded-lg bg-neutral-700 flex items-center justify-center text-neutral-300 text-xs font-sans shadow-inner border border-neutral-600"
            aria-label="Empty discard pile"
          >
            Empty
          </motion.div>
        )}
      </AnimatePresence>
      
      {numberOfCards > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/30 rounded-b-md md:rounded-b-lg pointer-events-none z-10">
          <AnimatePresence mode="wait">
            <motion.span
              key={`count-${numberOfCards}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="block text-center text-[0.55rem] md:text-[0.6rem] text-white font-semibold leading-tight"
            >
              {numberOfCards}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  return (
    <motion.div 
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col items-center justify-center p-1 group"
      whileHover={effectiveCanDraw && topCard ? { scale: 1.05, y: -4 } : {}}
      whileTap={effectiveCanDraw && topCard ? { scale: 0.95 } : {}}
      onClick={effectiveCanDraw && topCard ? onClick : undefined}
      style={{ cursor: (effectiveCanDraw && topCard) ? 'pointer' : 'default' }}
    >
      <span className="mb-0.5 text-[0.65rem] text-gray-500 font-medium group-hover:text-accent transition-colors">Discard Pile</span>
      {pileVisualContent}
    </motion.div>
  );
};

export default DiscardPileComponent; 