import React from 'react';
import CardComponent from './CardComponent';
import { motion, AnimatePresence } from 'motion/react';

interface DrawPileComponentProps {
  onClick?: () => void;
  canDraw: boolean;
  numberOfCards: number;
  isAnimatingDraw?: boolean;
}

const DrawPileComponent: React.FC<DrawPileComponentProps> = ({
  onClick,
  canDraw,
  numberOfCards,
  isAnimatingDraw
}) => {
  const cardWidth = "w-12 md:w-14";
  const cardAspectRatio = "aspect-[2.5/3.5]";

  const pileContent = (
    <AnimatePresence mode="wait">
      {numberOfCards > 0 ? (
        <motion.div 
          key="draw-pile-has-cards"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`relative ${cardWidth} ${cardAspectRatio} mx-auto`}
        >
          {/* Decorative card backs for stack effect - positioned absolutely behind the top card */}
          {numberOfCards > 1 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-md transform translate-x-0.5 translate-y-0.5 pointer-events-none`} />
          )}
          {numberOfCards > 2 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-sm transform translate-x-1 translate-y-1 pointer-events-none opacity-75`} />
          )}
          {numberOfCards > 3 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-xs transform translate-x-[1.5px] translate-y-[1.5px] pointer-events-none opacity-50`} />
          )}
          
          {/* Top card - interactive */}
          <div className="absolute w-full h-full z-10">
            <CardComponent
              card={null} // Always show as face-down pile
              isFaceUp={false}
              isInteractive={false} // Set to false, interaction handled by DrawPileComponent's root
              disableHoverEffect={true} // New prop to disable CardComponent's own hover
            />
          </div>

          {/* Animated card source for layout animation */}
          <AnimatePresence>
            {isAnimatingDraw && (
              <motion.div 
                key="draw-pile-source-animator"
                className="absolute w-full h-full z-20"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.05 } }}
              >
                <CardComponent card={null} isFaceUp={false} isInteractive={false} disableHoverEffect={true} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card count overlay at the bottom of the card */}
          <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/30 rounded-b-md md:rounded-b-lg pointer-events-none">
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
        </motion.div>
      ) : (
        <motion.div
          key="draw-pile-empty"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`${cardWidth} ${cardAspectRatio} mx-auto rounded-md md:rounded-lg bg-neutral-700 flex items-center justify-center text-neutral-300 text-xs font-sans shadow-inner border border-neutral-600`}
          aria-label="Empty draw pile"
        >
          Empty
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.div 
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col items-center justify-center p-1 group"
      whileHover={canDraw && numberOfCards > 0 ? { scale: 1.05, y: -4 } : {}}
      whileTap={canDraw && numberOfCards > 0 ? { scale: 0.95 } : {}}
      onClick={canDraw && numberOfCards > 0 ? onClick : undefined}
      style={{ cursor: (canDraw && numberOfCards > 0) ? 'pointer' : 'default' }}
    >
      <span className="mb-0.5 text-[0.65rem] text-gray-500 dark:text-gray-400 font-medium group-hover:text-accent transition-colors">Draw Pile</span>
      {pileContent}
    </motion.div>
  );
};

export default DrawPileComponent; 