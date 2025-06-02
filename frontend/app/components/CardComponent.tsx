import React, { useState, useEffect } from 'react';
import type { Card, ClientCard, HiddenCard } from 'shared-types';
import { motion, AnimatePresence } from 'motion/react';
import { FaEye, FaExchangeAlt } from 'react-icons/fa';

interface CardComponentProps {
  card: ClientCard | null;
  isFaceUp: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isInteractive?: boolean;
  isLocked?: boolean;
  forceShowFront?: boolean;
  showPeekHighlight?: boolean;
  disableHoverEffect?: boolean;
  isBeingTargetedForPeek?: boolean;
  isBeingTargetedForSwap?: boolean;
  isPlayerHandCard?: boolean;
}

const suitSymbols: { [key: string]: string } = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

const getSuitColor = (suit: string | undefined): string => {
  if (!suit) return 'text-neutral-900 dark:text-neutral-700';
  if (suit === 'H' || suit === 'D') {
    return 'text-red-600 dark:text-red-500';
  }
  return 'text-neutral-900 dark:text-black';
};

const cardVisualsVariants = {
    normal: {
        scale: 1,
        boxShadow: "0px 2px 5px rgba(0,0,0,0.2)",
        borderColor: "rgba(0,0,0,0.1)",
        borderWidth: "1px",
        filter: 'brightness(1)'
    },
    selected: {
        scale: 1.05,
        boxShadow: "0px 4px 10px rgba(0,0,0,0.3)",
        borderColor: "#60a5fa",
        borderWidth: "2px",
        filter: 'brightness(1)'
    },
    locked: {
        scale: 1,
        boxShadow: "0px 2px 5px rgba(0,0,0,0.2)",
        borderColor: "#f87171",
        borderWidth: "2px",
        filter: 'brightness(0.8)'
    },
    hiddenInHand: {
        scale: 1,
        boxShadow: "0px 2px 5px rgba(0,0,0,0.2)",
        borderColor: "rgba(0,0,0,0.1)",
        borderWidth: "1px",
        filter: 'brightness(1)',
        opacity: 1,
    },
};

const CardComponent: React.FC<CardComponentProps> = ({
  card,
  isFaceUp,
  onClick,
  isSelected = false,
  isInteractive = true,
  isLocked = false,
  forceShowFront = false,
  showPeekHighlight = false,
  disableHoverEffect = false,
  isBeingTargetedForPeek = false,
  isBeingTargetedForSwap = false,
  isPlayerHandCard = false,
}) => {
  const [showFront, setShowFront] = useState(forceShowFront || isFaceUp);
  const [isFlipping, setIsFlipping] = useState(false);

  const cardIdForLog = card && 'id' in card ? card.id : (card && !('isHidden' in card) ? `${card.rank}${card.suit}` : 'no-card');
  // console.log(`[CardComponent_RENDER ${cardIdForLog}] Props:`, { card, isFaceUp, forceShowFront, showFront, isFlipping });

  const targetShowFront = forceShowFront || isFaceUp;

  useEffect(() => {
    // console.log(`[CardComponent_EFFECT ${cardIdForLog}] Values:`, { targetShowFront, showFront, isFlipping, isFaceUp, forceShowFront });
    if (targetShowFront !== showFront) {
      // console.log(`[CardComponent_EFFECT ${cardIdForLog}] Condition 1: Setting isFlipping = true (Target: ${targetShowFront}, Current: ${showFront})`);
      setIsFlipping(true);
    } else if (targetShowFront === showFront && isFlipping) {
      // console.log(`[CardComponent_EFFECT ${cardIdForLog}] Condition 2: Target matches current, but was flipping. Setting isFlipping = false.`);
      // This case handles when the animation completes and the internal showFront aligns with targetShowFront
      // setIsFlipping(false); // This is now handled by handleFlipAnimationComplete
    } else if (targetShowFront === showFront && !isFlipping) {
      // console.log(`[CardComponent_EFFECT ${cardIdForLog}] Condition 3: Target matches current, not flipping. Stable state.`);
    } else {
      // console.log(`[CardComponent_EFFECT ${cardIdForLog}] Condition 4: Target DOES NOT match current, IS flipping. Animation in progress.`);
    }
  }, [targetShowFront, showFront, isFlipping, cardIdForLog]); // cardIdForLog only for logging

  const handleFlipAnimationComplete = () => {
    // console.log(`[CardComponent_FlipComplete ${cardIdForLog}] CALLED. isFlipping: ${isFlipping}. Current prop target: ${targetShowFront}. showFront state before: ${showFront}`);
    if (isFlipping) {
      setShowFront(targetShowFront);
      setIsFlipping(false);
      // console.log(`[CardComponent_FlipComplete ${cardIdForLog}] State AFTER update: showFront=${targetShowFront}, isFlipping=false`);
    } else {
      // console.log(`[CardComponent_FlipComplete ${cardIdForLog}] Called but not isFlipping OR target already matches. No state change needed from this specific call. showFront state: ${showFront}`);
    }
  };

  const cardContent = card && !('isHidden' in card) ? card : null;
  const isActuallyHiddenType = card && 'isHidden' in card;

  // Determine which face to render based on props, managing AnimatePresence key
  const renderFrontFaceBasedOnProps = forceShowFront || isFaceUp;
  // console.log(`[CardComponent_PRE_RENDER_VISUALS ${cardIdForLog}] renderFrontFaceBasedOnProps: ${renderFrontFaceBasedOnProps}`, { forceShowFront, isFaceUp, showFront });

  const isHiddenInHandVisualEffect = !isActuallyHiddenType && !showFront && !forceShowFront && !isFaceUp;

  let currentAnimateState: keyof typeof cardVisualsVariants = 'normal';
  if (isLocked) {
    currentAnimateState = 'locked';
  } else if (isHiddenInHandVisualEffect) {
    currentAnimateState = 'hiddenInHand';
  } else if (isSelected) {
    currentAnimateState = 'selected';
  }

  const effectiveIsInteractive = isInteractive && !isLocked && !isFlipping;

  const handleClick = () => {
    if (effectiveIsInteractive && onClick) {
      onClick();
    }
  };
  
  return (
    <motion.div
      className={`relative w-full h-full cursor-pointer rounded-md overflow-hidden shadow-md ${showPeekHighlight ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-neutral-800' : ''}`}
      variants={cardVisualsVariants}
      animate={currentAnimateState}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      whileHover={!disableHoverEffect && effectiveIsInteractive ? { scale: 1.1, y: -5, boxShadow: "0px 10px 20px rgba(0,0,0,0.25)" } : {}}
      whileTap={!disableHoverEffect && effectiveIsInteractive ? { scale: 0.95 } : {}}
      onClick={handleClick}
      style={{
        perspective: '1000px',
        // border: isSelected ? '2px solid #60a5fa' : (isLocked ? '2px solid #f87171' : '1px solid rgba(0,0,0,0.1)'), // Border handled by variants
        // filter: isLocked ? 'brightness(0.8)' : 'none', // Filter handled by variants
      }}
      aria-label={renderFrontFaceBasedOnProps ? `${cardContent?.rank || ''} of ${cardContent?.suit || ''}` : "Hidden card"}
      role={effectiveIsInteractive && onClick ? 'button' : undefined}
      tabIndex={effectiveIsInteractive && onClick ? 0 : undefined}
    >
      <AnimatePresence initial={false}>
        {renderFrontFaceBasedOnProps ? (
          <motion.div
            key="front"
            className="absolute inset-0 w-full h-full bg-white dark:bg-neutral-100 rounded-md flex flex-col items-stretch justify-between p-1.5 md:p-2 shadow-md"
            initial={{ rotateY: -180 }} 
            animate={{ rotateY: 0 }}    
            exit={{ rotateY: 180 }}     
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onAnimationComplete={handleFlipAnimationComplete} 
          >
            {(() => {
              // Logging for diagnostics
              // if (renderFrontFaceBasedOnProps) { // Keep this commented out for now to reduce console noise unless needed
              //   console.log(`[CardComponent_FRONT_RENDER ${cardIdForLog}] card:`, JSON.stringify(card), `cardContent:`, JSON.stringify(cardContent), `isActuallyHiddenType: ${isActuallyHiddenType}`, `forceShowFront: ${forceShowFront}`);
              // }

              // If we must show the front (forceShowFront) AND we have actual card content (rank/suit)
              if (forceShowFront && cardContent) {
                return (
                  <>
                    <div className="flex items-start">
                      <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)}`}>
                        <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                        <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-end self-end">
                      <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)} transform rotate-180`}>
                        <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                        <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                      </div>
                    </div>
                  </>
                );
              }
              // Otherwise (not forcing front), if it's not a hidden-type card AND we have actual card content
              if (!isActuallyHiddenType && cardContent) {
                return (
                  <>
                    <div className="flex items-start">
                      <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)}`}>
                        <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                        <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-end self-end">
                      <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)} transform rotate-180`}>
                        <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                        <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                      </div>
                    </div>
                  </>
                );
              }
              // Fallback/Error states if we intended to show the front but couldn't render details:
              if (renderFrontFaceBasedOnProps) {
                return (
                  <div className="flex items-center justify-center w-full h-full">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {isActuallyHiddenType ? "Card Privately Hidden" : (cardContent ? "Display Error" : "No Card Data")}
                    </p>
                  </div>
                );
              }
              return null; // Should not be reached if back face is rendered due to AnimatePresence logic
            })()}
          </motion.div>
        ) : (
          <motion.div
            key="back"
            className="absolute inset-0 w-full h-full bg-neutral-700 dark:bg-neutral-800 rounded-md flex items-center justify-center shadow-inner"
            initial={{ rotateY: 180 }} 
            animate={{ rotateY: 0 }}    
            exit={{ rotateY: -180 }}    
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onAnimationComplete={handleFlipAnimationComplete} 
          >
            {/* Removed inner div for a cleaner back */}
          </motion.div>
        )}
      </AnimatePresence>

      {(isBeingTargetedForPeek || isBeingTargetedForSwap) && !renderFrontFaceBasedOnProps && (
        <motion.div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md pointer-events-none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
        >
          {isBeingTargetedForPeek && 
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}>
              <FaEye className="text-white text-2xl md:text-3xl opacity-80" />
            </motion.div>
          }
          {isBeingTargetedForSwap && 
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}>
              <FaExchangeAlt className="text-white text-2xl md:text-3xl opacity-80" />
            </motion.div>
          }
        </motion.div>
      )}
    </motion.div>
  );
};

export default CardComponent;
