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
    normal: { scale: 1, boxShadow: "0px 2px 5px rgba(0,0,0,0.2)" },
    selected: { scale: 1.05, boxShadow: "0px 4px 10px rgba(0,0,0,0.3)" },
    hiddenInHand: { opacity: 0.7, scale: 0.95 },
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
  if (isHiddenInHandVisualEffect) currentAnimateState = 'hiddenInHand';
  else if (isSelected) currentAnimateState = 'selected';

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
      whileHover={!disableHoverEffect && effectiveIsInteractive ? { scale: 1.1, y: -5, boxShadow: "0px 10px 20px rgba(0,0,0,0.25)" } : {}}
      whileTap={!disableHoverEffect && effectiveIsInteractive ? { scale: 0.95 } : {}}
      onClick={handleClick}
      style={{
        perspective: '1000px',
        border: isSelected ? '2px solid #60a5fa' : (isLocked ? '2px solid #f87171' : '1px solid rgba(0,0,0,0.1)'),
        filter: isLocked ? 'brightness(0.8)' : 'none',
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
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onAnimationComplete={handleFlipAnimationComplete} 
          >
            {(() => {
              if (renderFrontFaceBasedOnProps) {
                console.log(`[CardComponent_FRONT_RENDER ${cardIdForLog}] cardContent:`, JSON.stringify(cardContent), `isActuallyHiddenType: ${isActuallyHiddenType}`);
              }
              return null; // This block doesn't render anything
            })()}
            {card && !isActuallyHiddenType && (
              <>
                <div className="h-1/4 flex items-start">
                  <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)}`}>
                    <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                    <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                  </div>
                </div>
                <div className="h-1/2 flex items-center justify-center">
                  <span className={`font-sans font-semibold text-4xl md:text-5xl lg:text-6xl ${getSuitColor(cardContent?.suit)} opacity-90`}>
                    {cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}
                  </span>
                </div>
                <div className="h-1/4 flex items-end justify-end">
                  <div className={`font-sans text-base md:text-lg lg:text-xl ${getSuitColor(cardContent?.suit)} transform rotate-180`}>
                    <span className="block -mb-1 md:-mb-1.5 leading-none">{cardContent?.rank}</span>
                    <span className="block text-sm md:text-base leading-none">{cardContent?.suit ? suitSymbols[cardContent?.suit] : ''}</span>
                  </div>
                </div>
              </>
            )}
            {isActuallyHiddenType && renderFrontFaceBasedOnProps && (
                <div className="flex items-center justify-center w-full h-full">
                    <p className="text-xs text-neutral-500">Error: Hidden card forced face up.</p>
                </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="back"
            className="absolute inset-0 w-full h-full bg-gradient-to-br from-neutral-600 to-neutral-800 dark:from-neutral-700 dark:to-neutral-900 rounded-md flex items-center justify-center shadow-inner"
            initial={{ rotateY: 180 }} 
            animate={{ rotateY: 0 }}    
            exit={{ rotateY: -180 }}    
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onAnimationComplete={handleFlipAnimationComplete} 
          >
            <div className="w-3/5 h-3/5 bg-neutral-500/30 dark:bg-neutral-800/50 rounded-sm shadow-md"></div>
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
          {isBeingTargetedForPeek && <FaEye className="text-white text-2xl md:text-3xl opacity-80" />}
          {isBeingTargetedForSwap && <FaExchangeAlt className="text-white text-2xl md:text-3xl opacity-80" />}
        </motion.div>
      )}
    </motion.div>
  );
};

export default CardComponent;
