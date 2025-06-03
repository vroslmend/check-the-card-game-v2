import React, { useState, useEffect, useRef } from 'react';
import type { Card } from 'shared-types';
import CardComponent from './CardComponent';
import { motion, AnimatePresence } from 'motion/react';

interface DiscardPileComponentProps {
  topCard: Card | null;
  onClick?: () => void;
  canDraw: boolean;
  isSealed: boolean;
  numberOfCards: number;
  animateCardInWithId?: string | null;
}

const DiscardPileComponent: React.FC<DiscardPileComponentProps> = ({
  topCard,
  onClick,
  canDraw,
  isSealed,
  numberOfCards,
  animateCardInWithId,
}) => {
  const cardWidth = "w-12 md:w-14";
  const cardAspectRatio = "aspect-[2.5/3.5]";
  const effectiveCanDraw = canDraw && !isSealed;

  // Use a ref to keep track of the previous value for animation
  const prevCountRef = useRef(numberOfCards);
  const [animKey, setAnimKey] = useState(0);
  
  // When the count changes, update the animation key to force a re-render
  useEffect(() => {
    if (numberOfCards !== prevCountRef.current) {
      setAnimKey(key => key + 1);
      prevCountRef.current = numberOfCards;
    }
  }, [numberOfCards]);

  const layoutIdForTopCard = (animateCardInWithId && topCard && topCard.id === animateCardInWithId) ? `card-anim-${topCard.id}` : undefined;

  // Add a visual debug marker for receiving cards with animations
  const isReceivingAnimatedCard = !!layoutIdForTopCard;
  
  // Capture values for onLayoutAnimationComplete
  const wasLayoutTargetForArrivalThisRender = !!layoutIdForTopCard;
  const originalAnimateCardInWithId_atDefinition = animateCardInWithId;
  const originalTopCardId_atDefinition = topCard?.id;
  const originalLayoutId_atDefinition = layoutIdForTopCard;

  if (topCard && animateCardInWithId && topCard.id === animateCardInWithId) {
    console.log(`[SwapAnimLayout DEBUG] DiscardPile RENDER: topCard.id=${topCard.id}, animateCardInWithId_PROP=${animateCardInWithId}, appliedLayoutId=${layoutIdForTopCard}`);
  }

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
      
      <AnimatePresence mode="popLayout">
        {topCard ? (
          <motion.div
            key={layoutIdForTopCard && animateCardInWithId ? animateCardInWithId : (topCard.id || `${topCard.rank}-${topCard.suit}`)}
            layoutId={layoutIdForTopCard}
            layout={!!layoutIdForTopCard}
            initial={layoutIdForTopCard ? { 
              opacity: 1,
              scale: 1,
              rotate: 0
            } : { 
              opacity: 0, 
              scale: 0.7, 
              rotate: -15
            }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              rotate: 0,
              y: 0
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.7, 
              rotate: 15
            }}
            transition={(layoutIdForTopCard) 
              ? { 
                  type: 'spring', 
                  stiffness: 160,
                  damping: 15,
                  mass: 0.9,
                  bounce: 0.4,
                  restDelta: 0.001,
                  restSpeed: 0.001
                }
              : { 
                  type: 'spring', 
                  stiffness: 300, 
                  damping: 30
                }
            }
            className={`w-full h-full absolute inset-0 ${isReceivingAnimatedCard ? 'z-50' : 'z-10'}`}
            style={{
              zIndex: layoutIdForTopCard ? 200 : 10,
              pointerEvents: 'none',
              transformOrigin: 'center center'
            }}
            onAnimationStart={() => {
              if (layoutIdForTopCard && topCard && topCard.id === animateCardInWithId) {
                console.log(`[SwapAnimLayout DEBUG] DiscardPile CARD ANIMATION START (Arriving Card ID: ${topCard.id}): animateCardInWithId_PROP=${animateCardInWithId}, applied layoutId=${layoutIdForTopCard}`);
              }
            }}
            onLayoutAnimationComplete={
              wasLayoutTargetForArrivalThisRender ? () => {
                if (originalLayoutId_atDefinition && originalTopCardId_atDefinition === originalAnimateCardInWithId_atDefinition) {
                  console.log(`[SwapAnimLayout DEBUG] DiscardPile CARD LAYOUT ANIMATION COMPLETE (Arrived Card ID: ${originalTopCardId_atDefinition}): animateCardInWithId_PROP_AT_DEF=${originalAnimateCardInWithId_atDefinition}, appliedLayoutId_AT_DEF=${originalLayoutId_atDefinition}`);
                } else {
                  console.log(`[SwapAnimLayout DEBUG] DiscardPile LAYOUT ANIMATION COMPLETE called BUT MISMATCH or PROPS CHANGED: originalLayoutId=${originalLayoutId_atDefinition}, originalTopCardId=${originalTopCardId_atDefinition}, originalAnimateId=${originalAnimateCardInWithId_atDefinition}. Current topCardId=${topCard?.id}, current animateId=${animateCardInWithId}, current layoutIdForTopCard=${layoutIdForTopCard}`);
                }
              } : undefined
            }
          >
            {/* Shadow overlay with separate animation */}
            <AnimatePresence>
              {layoutIdForTopCard && (
                <motion.div 
                  className="absolute inset-0 rounded-md md:rounded-lg pointer-events-none"
                  style={{
                    boxShadow: '0 6px 20px 6px rgba(0,0,0,0.5)',
                    zIndex: -1
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ 
                    opacity: 1,
                    scale: 1
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ 
                    opacity: { duration: 0.5, ease: "easeOut" },
                    scale: { 
                      duration: 0.8,
                      type: "spring",
                      bounce: 0.4
                    }
                  }}
                />
              )}
            </AnimatePresence>

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

            {layoutIdForTopCard && (
              <motion.div 
                className="absolute inset-0 bg-transparent rounded-md md:rounded-lg pointer-events-none"
                initial={{ scale: 1.2, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ 
                  duration: 0.4,
                  ease: "easeOut"
                }}
              />
            )}
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
        <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/30 rounded-b-md md:rounded-b-lg pointer-events-none z-[250]">
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