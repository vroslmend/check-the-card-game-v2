import React, { useState, useEffect, useRef } from 'react';
import type { Card, ClientCard, ClientPlayerState, LastRegularSwapInfo } from 'shared-types';
import CardComponent from './CardComponent';
import { motion, AnimatePresence, TargetAndTransition, VariantLabels } from 'motion/react';

// Define a local type for a single ability target, matching CheckGameBoard.tsx
type AbilityTarget = { playerID: string; cardIndex: number; type: 'peek' | 'swap' };

interface PlayerHandComponentProps {
  playerID: string;
  playerState: ClientPlayerState | null;
  actualHandForDisplay: ClientCard[];
  onCardClick: (playerID: string, cardIndex: number) => void;
  isViewingPlayer: boolean;
  selectedCardIndices?: number[];
  multiSelectedCardIndices?: number[];
  cardsToForceShowFaceUp?: { [cardIndex: number]: boolean };
  abilityTargetsOnThisHand?: AbilityTarget[]; // New prop
  isLocked?: boolean;
  hasCalledCheck?: boolean;
  cardsBeingPeeked?: ClientCard[] | null;
  isInitialPeekActive?: boolean;
  swappingOutCardId?: string | null; // ID of the card being swapped out, for animation
  lastRegularSwapInfo?: LastRegularSwapInfo | null; // New prop for swap highlight
}

const cardContainerVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
  normalExit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  swappingOutExit: {
    opacity: 0,
    scale: 0.5,
    rotate: -15,
    y: -50,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  layoutTransition: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
};

const PlayerHandComponent: React.FC<PlayerHandComponentProps> = React.memo(({
  playerID,
  playerState,
  actualHandForDisplay,
  onCardClick,
  isViewingPlayer,
  selectedCardIndices = [],
  multiSelectedCardIndices = [],
  cardsToForceShowFaceUp = {},
  abilityTargetsOnThisHand = [], // Default to empty array
  isLocked = false,
  hasCalledCheck = false,
  cardsBeingPeeked = null,
  isInitialPeekActive = false,
  swappingOutCardId,
  lastRegularSwapInfo,
}) => {
  const [highlightedSwapIndex, setHighlightedSwapIndex] = useState<number | null>(null);
  const lastProcessedSwapTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (lastRegularSwapInfo && lastRegularSwapInfo.playerId === playerID && !isViewingPlayer) {
      // Only trigger for genuinely new swap events for this hand
      if (lastRegularSwapInfo.timestamp !== lastProcessedSwapTimestampRef.current) {
        setHighlightedSwapIndex(lastRegularSwapInfo.handIndex);
        lastProcessedSwapTimestampRef.current = lastRegularSwapInfo.timestamp; // Store the timestamp of this new event

        timerId = setTimeout(() => {
          // Only clear if this timer corresponds to the currently active highlighted event
          if (lastProcessedSwapTimestampRef.current === lastRegularSwapInfo.timestamp) {
            setHighlightedSwapIndex(null);
            // Do not null out lastProcessedSwapTimestampRef.current here; it reflects the last *processed* swap.
            // It will be nulled if lastRegularSwapInfo itself becomes null (see else block).
          }
        }, 2000);
      }
    } else {
      // lastRegularSwapInfo is null, or doesn't apply to this hand, or it's the viewing player.
      // Ensure any existing highlight is cleared.
      if (highlightedSwapIndex !== null) {
        setHighlightedSwapIndex(null);
      }
      // If lastRegularSwapInfo is now null (or irrelevant), reset the processed timestamp ref
      // so that a future swap event (if LRSInfo gets populated again) is treated as new.
      if (lastProcessedSwapTimestampRef.current !== null && 
          (!lastRegularSwapInfo || lastRegularSwapInfo.playerId !== playerID || lastRegularSwapInfo.timestamp !== lastProcessedSwapTimestampRef.current)) {
        lastProcessedSwapTimestampRef.current = null;
      }
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [lastRegularSwapInfo, playerID, isViewingPlayer]); // Dependency array is crucial

  if (!playerState) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>Loading player data...</div>;
  }

  if (!actualHandForDisplay) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>Hand data missing.</div>;
  }

  const isCardBeingPeeked = (card: ClientCard | null, cardIndex: number): boolean => {
    if (!isInitialPeekActive || !cardsBeingPeeked || !card || ('isHidden' in card)) {
      return false;
    }
    return cardsBeingPeeked.some(peekedCard => 
        !('isHidden' in peekedCard) &&
        peekedCard.rank === (card as Card).rank && peekedCard.suit === (card as Card).suit
    );
  };

  const numberOfCardsToRender = actualHandForDisplay.length;
  let numVisualRows = 0;
  let numVisualCols = 0;
  
  if (numberOfCardsToRender > 0) {
    if (numberOfCardsToRender === 1) {
      numVisualCols = 1;
      numVisualRows = 1;
    } else if (numberOfCardsToRender === 2) {
      numVisualCols = 2;
      numVisualRows = 1;
    } else {
      numVisualRows = 2; // Max 2 rows
      numVisualCols = Math.ceil(numberOfCardsToRender / numVisualRows);
    }
  } else { // No cards
    numVisualCols = 1; // Smallest grid for placeholder
    numVisualRows = 1;
  }

  // visualGridCells should directly correspond to the order in actualHandForDisplay for cards present,
  // then padded with nulls if the grid is larger than the number of cards.
  const visualGridCells: (ClientCard | null)[] = Array(numVisualRows * numVisualCols).fill(null);
  for (let i = 0; i < numberOfCardsToRender; i++) {
    visualGridCells[i] = actualHandForDisplay[i];
  }

  const handPadding = 'p-1 md:p-1.5';
  const handAreaClasses = [
    handPadding,
    'rounded-lg md:rounded-xl',
    'shadow-sm',
    'bg-white/80 dark:bg-neutral-800/70',
    'backdrop-blur-sm',
    'flex', 'justify-center', 'items-center',
    playerState?.forfeited ? 'opacity-50 pointer-events-none' : (isLocked ? 'opacity-60' : ''),
    hasCalledCheck && !isLocked && !playerState?.forfeited ? 'bg-amber-50/60 dark:bg-amber-900/30' : '',
    'transition-all', 'duration-150',
  ].join(' ');

  const gridGap = 'gap-1 md:gap-1.5';
  const cardWidth = 'w-12 md:w-14';
  const cardHeight = 'aspect-[2.5/3.5]';

  const determineExitVariant = (isSwapping: boolean): VariantLabels | TargetAndTransition => {
      return isSwapping ? "swappingOutExit" : "normalExit";
  };

  const getCardId = (actualCard: ClientCard, cardIndex: number): string => {
    if (actualCard && actualCard.id) {
      return actualCard.id; // Prioritize existing ID from ClientCard
    }
    // Fallback if ID is somehow missing, though it should be set by the server or client transformations
    return `card-${playerID}-${cardIndex}`;
  };

  const playerHand = actualHandForDisplay;

  return (
    <div
      className={handAreaClasses}
      aria-label={isViewingPlayer ? 'Your hand' : `${playerState.name || playerID}\'s hand`}
    >
      {numberOfCardsToRender === 0 ? (
        <div className={`px-2 py-1 text-xs text-gray-500 dark:text-gray-400 italic ${cardWidth}`}>0 cards</div>
      ) : (
        <motion.div
          className={`grid ${gridGap}`}
          style={{
            gridTemplateColumns: `repeat(${numVisualCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${numVisualRows}, auto)`,
          }}
        >
          <AnimatePresence>
            {visualGridCells.map((cellCard, cellIndex) => {
              // cellCard is actualHandForDisplay[cellIndex] if a card exists at this slot,
              // otherwise it's null (for empty grid slots if hand is smaller than grid dimensions)
              // originalCardIndex is effectively cellIndex if cellCard is not null and cellIndex < numberOfCardsToRender
              const originalCardIndex = cellCard ? actualHandForDisplay.findIndex(c => {
                if (!cellCard) return false; // Should not happen if cellCard is truthy
                // Compare by ID for object equality since cards can be recreated
                if (('isHidden' in c && 'isHidden' in cellCard && c.id === cellCard.id) || 
                    (!('isHidden' in c) && !('isHidden' in cellCard) && c.id === cellCard.id)) {
                  return true;
                }
                return false;
              }) : -1;

              // Fallback if findIndex fails but cellCard exists (should imply cellIndex is the originalIndex)
              // This is more a safeguard; findIndex should work if IDs are stable and cellCard is from actualHandForDisplay
              const cardIsPresentInHand = originalCardIndex !== -1;

              let showFaceUp = false;
              if (cellCard && cardIsPresentInHand) { // Ensure we are working with a card that's actually in the hand
                if (isViewingPlayer) {
                  if (isCardBeingPeeked(cellCard, originalCardIndex)) {
                    showFaceUp = true;
                  } else if (cardsToForceShowFaceUp[originalCardIndex]) {
                    showFaceUp = true;
                  } else if (cellCard && !('isHidden' in cellCard)) {
                     showFaceUp = false; 
                  }
                } else { // Opponent's hand
                  showFaceUp = !!cardsToForceShowFaceUp[originalCardIndex];
                }
              } else if (cellCard && !('isHidden' in cellCard)) { // Should not be hit if cardIsPresentInHand is false
                showFaceUp = true; 
              }

              const isSelectedForSingleAction = cardIsPresentInHand && selectedCardIndices.includes(originalCardIndex);
              const isSelectedForMultiAction = cardIsPresentInHand && multiSelectedCardIndices.includes(originalCardIndex);

              const cardId = cellCard && !('isHidden' in cellCard) ? (cellCard as Card).id : null;
              const isThisCardSwappingOut = !!(swappingOutCardId && cardId && cardId === swappingOutCardId);
              
              // Use cellIndex for the key of the motion.div wrapper for grid stability,
              // but originalCardIndex for logic tied to the card data itself.
              const stableCardSlotKey = `${playerID}-slot-${cellIndex}`;

              // Check if this card is being targeted by a global ability
              const currentGlobalTarget = cardIsPresentInHand ? abilityTargetsOnThisHand?.find(target => target.cardIndex === originalCardIndex) : undefined;
              const isBeingTargetedForPeek = currentGlobalTarget?.type === 'peek';
              const isBeingTargetedForSwap = currentGlobalTarget?.type === 'swap';
              
              // Logging for opponent peek (can be removed after debugging)
              if (!isViewingPlayer && showFaceUp && cardIsPresentInHand) {
                console.log(`[PlayerHandComponent-OPPONENT-PEEK-DEBUG] Key: ${stableCardSlotKey}`, {
                  cardForDisplay: cellCard,
                  isFaceUpProp: showFaceUp,
                  forceShowFrontProp: (isInitialPeekActive && isCardBeingPeeked(cellCard, originalCardIndex)) || (!isViewingPlayer && showFaceUp),
                  showPeekHighlightProp: (isInitialPeekActive && isCardBeingPeeked(cellCard, originalCardIndex) && !cardsToForceShowFaceUp[originalCardIndex]) || (!isViewingPlayer && showFaceUp),
                  originalCardIndex,
                  cardsToForceShowFaceUp
                });
              }

              const isMultiSelected = multiSelectedCardIndices?.includes(originalCardIndex) ?? false;
              const isAbilityTargetedForPeek = abilityTargetsOnThisHand?.some(target => target.cardIndex === originalCardIndex && target.type === 'peek') ?? false;
              const isAbilityTargetedForSwap = abilityTargetsOnThisHand?.some(target => target.cardIndex === originalCardIndex && target.type === 'swap') ?? false;
              const isBeingSwappedByPlayer = swappingOutCardId === cardId;

              // Determine if this specific card should get the temporary swap highlight
              const showSwapHighlight = !isViewingPlayer && highlightedSwapIndex === originalCardIndex;

              let cardWrapperClassName = "relative w-16 md:w-20 aspect-[2.5/3.5] overflow-hidden rounded-lg";

              if (isSelectedForSingleAction || isSelectedForMultiAction) {
                cardWrapperClassName += " ring-2 ring-accent ring-offset-2 ring-offset-neutral-800";
              }
              
              return (
                <motion.div
                  key={stableCardSlotKey}
                  layoutId={cardId ? `card-${cardId}` : undefined}
                  layout
                  variants={cardContainerVariants}
                  initial="initial"
                  animate="animate"
                  exit={determineExitVariant(isThisCardSwappingOut)}
                  custom={isThisCardSwappingOut}
                  transition={cardContainerVariants.layoutTransition}
                  className={cardWrapperClassName}
                  onClick={() => {
                    if (cardIsPresentInHand) { // Ensure click is on an actual card
                      onCardClick(playerID, originalCardIndex);
                    } else {
                      // Optional: handle click on empty slot if needed, or do nothing
                      // console.warn("[PlayerHandComponent] Clicked on an empty card slot. CellIndex:", cellIndex);
                    }
                  }}
                >
                  {cellCard ? (
                    <CardComponent
                      card={cellCard}
                      isFaceUp={showFaceUp}
                      isSelected={isSelectedForSingleAction || isSelectedForMultiAction}
                      isInteractive={cardIsPresentInHand && !isLocked && (!isInitialPeekActive || isCardBeingPeeked(cellCard, originalCardIndex)) || (!isViewingPlayer && showFaceUp && cardIsPresentInHand)}
                      isLocked={isLocked}
                      forceShowFront={
                        (cardIsPresentInHand && isInitialPeekActive && isCardBeingPeeked(cellCard, originalCardIndex)) ||
                        (!isViewingPlayer && showFaceUp && cardIsPresentInHand) 
                      } 
                      showPeekHighlight={
                        (cardIsPresentInHand && isInitialPeekActive && isCardBeingPeeked(cellCard, originalCardIndex) && !cardsToForceShowFaceUp[originalCardIndex]) ||
                        (!isViewingPlayer && showFaceUp && cardIsPresentInHand)
                      }
                      isBeingTargetedForPeek={isBeingTargetedForPeek}
                      isBeingTargetedForSwap={isBeingTargetedForSwap}
                      isPlayerHandCard={true}
                    />
                  ) : (
                    <div className={`${cardWidth} ${cardHeight} rounded-md md:rounded-lg bg-black/5 dark:bg-white/5`} /> 
                  )}
                  <AnimatePresence>
                    {showSwapHighlight && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none rounded-lg"
                        style={{
                          backgroundSize: "200% 100%",
                          backgroundImage: "linear-gradient(to right, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)",
                        }}
                        initial={{ backgroundPosition: "-150% 0%", opacity: 0.7 }}
                        animate={{ backgroundPosition: "150% 0%", opacity: [0.7, 1, 0.7] }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        transition={{
                          duration: 0.7,
                          ease: "linear",
                          opacity: {
                            duration: 0.7,
                            ease: "easeInOut",
                            times: [0, 0.5, 1]
                          }
                        }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
});

export default PlayerHandComponent;