import React, { useState, useEffect } from 'react';
import CardComponent from './CardComponent';
import { motion, AnimatePresence } from 'motion/react';

interface DrawPileComponentProps {
  numberOfCards: number;
  onClick?: () => void;
  canDraw: boolean;
  cardIdAnimatingOut?: string | null;
  deckDrawLayoutId?: string | null;
}

const DrawPileComponent: React.FC<DrawPileComponentProps> = ({
  numberOfCards,
  onClick,
  canDraw,
  cardIdAnimatingOut,
  deckDrawLayoutId,
}) => {
  const cardWidth = "w-12 md:w-14";
  const cardAspectRatio = "aspect-[2.5/3.5]";
  const [isHovered, setIsHovered] = useState(false);
  const [localAnimatingCardId, setLocalAnimatingCardId] = useState<string | null>(null);

  useEffect(() => {
    const newId = cardIdAnimatingOut === undefined ? null : cardIdAnimatingOut;
    setLocalAnimatingCardId(newId);
    if (newId) {
      console.log(`[SwapAnimLayout DEBUG] DrawPileComponent|useEffect - Setting localAnimatingCardId to: ${newId}`);
    } else {
      console.log(`[SwapAnimLayout DEBUG] DrawPileComponent|useEffect - Setting localAnimatingCardId to null (prop was null or undefined).`);
    }
  }, [cardIdAnimatingOut]);

  const pileContent = (
    <AnimatePresence mode="wait">
      {numberOfCards > 0 || localAnimatingCardId ? (
        <motion.div
          key="draw-pile-has-cards"
          className={`relative ${cardWidth} ${cardAspectRatio} mx-auto`}
        >
          {/* Decorative card backs for stack effect - rendered if underlying cards exist */}
          {numberOfCards > 1 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-md transform translate-x-0.5 translate-y-0.5 pointer-events-none`} />
          )}
          {numberOfCards > 2 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-sm transform translate-x-1 translate-y-1 pointer-events-none opacity-75`} />
          )}
          {numberOfCards > 3 && (
            <div className={`absolute w-full h-full rounded-md md:rounded-lg bg-gradient-to-br from-neutral-500 to-neutral-700 dark:from-neutral-600 dark:to-neutral-800 shadow-xs transform translate-x-[1.5px] translate-y-[1.5px] pointer-events-none opacity-50`} />
          )}
          
          {/* Static Top card - only show if no card is animating out AND there are cards */}
          {(!localAnimatingCardId && numberOfCards > 0) && (
             <div className="absolute w-full h-full z-10">
                <CardComponent
                  card={null} 
                  isFaceUp={false}
                  isInteractive={false} 
                  disableHoverEffect={true}
                />
            </div>
          )}

          {/* Animated card source - conditionally rendered */}
          {localAnimatingCardId && (
            <motion.div
              key={`animating-out-${localAnimatingCardId}`}
              layoutId={deckDrawLayoutId || `card-anim-${localAnimatingCardId}`}
              className="absolute inset-0 w-full h-full z-[100] pointer-events-none"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              transition={{
                default: { duration: 0.3 },
                layout: { duration: 2, type: "spring", stiffness: 50, damping: 15 }
              }}
            >
              <div className="w-full h-full bg-red-500 rounded-md shadow-lg"></div>
            </motion.div>
          )}

          {/* Card count overlay - only show if no card is animating out OR if it's not the last card animating out */}
          {(!localAnimatingCardId || numberOfCards > 0) && (
            <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/30 rounded-b-md md:rounded-b-lg pointer-events-none z-[60]">
              <div className="relative w-full h-4 overflow-hidden flex items-center justify-center">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`counter-${numberOfCards}`}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      transition: { 
                        duration: 0.15,
                        ease: "easeOut"
                      }
                    }}
                    exit={{ 
                      opacity: 0,
                      scale: 0.8,
                      transition: {
                        duration: 0.1, 
                        ease: "easeIn"
                      }
                    }}
                  >
                    <span className="text-[0.5rem] md:text-[0.55rem] text-white font-semibold">
                      {numberOfCards}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
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
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col items-center justify-center p-1 group"
      whileHover={canDraw && numberOfCards > 0 && !localAnimatingCardId ? { scale: 1.05, y: -4 } : {}}
      whileTap={canDraw && numberOfCards > 0 && !localAnimatingCardId ? { scale: 0.95 } : {}}
      onClick={(canDraw && numberOfCards > 0 && !localAnimatingCardId) ? onClick : undefined}
      style={{ cursor: (canDraw && numberOfCards > 0 && !localAnimatingCardId) ? 'pointer' : 'default' }}
    >
      <span className="mb-0.5 text-[0.65rem] text-gray-500 dark:text-gray-400 font-medium group-hover:text-accent transition-colors">Draw Pile</span>
      {pileContent}
    </motion.div>
  );
};

export default DrawPileComponent; 