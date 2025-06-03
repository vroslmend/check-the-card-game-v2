import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Card, ClientCard, ClientPlayerState, LastRegularSwapInfo } from 'shared-types';
import CardComponent from './CardComponent';
import { motion, AnimatePresence, TargetAndTransition, VariantLabels, MotionProps } from 'motion/react';

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
  cardIdMovingToHand?: string | null;
  cardIdMovingToDiscard?: string | null;
  cardArrivingFromHolding?: ClientCard | null; // New prop
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

const FLIP_ANIMATION_DURATION_MS = 350; // Added for flip timing

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
  cardIdMovingToHand,
  cardIdMovingToDiscard,
  cardArrivingFromHolding,
}) => {
  const [highlightedSwapIndex, setHighlightedSwapIndex] = useState<number | null>(null);
  const lastProcessedSwapTimestampRef = useRef<number | null>(null);
  const prevCardIdMovingToHandRef = useRef<string | null | undefined>(null);
  const [permanentlySettledCardIds, setPermanentlySettledCardIds] = useState<Set<string>>(new Set());
  const [settledCardFullData, setSettledCardFullData] = useState<Map<string, ClientCard>>(new Map()); // New state

  // New state for managing the flip sequence
  const [cardIdMidFlip, setCardIdMidFlip] = useState<string | null>(null);

  useEffect(() => {
    prevCardIdMovingToHandRef.current = cardIdMovingToHand;
  }, [cardIdMovingToHand]);

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

  useEffect(() => {
    // This effect runs when cardIdMovingToHand (the prop) changes.
    // We look at what prevCardIdMovingToHandRef.current *was* before this change.
    if (prevCardIdMovingToHandRef.current && // It was a card ID in the previous render cycle
        cardIdMovingToHand === null &&       // And now cardIdMovingToHand prop is null
        prevCardIdMovingToHandRef.current !== cardIdMovingToHand) { // Ensure it actually changed from an ID to null
      // The card with ID prevCardIdMovingToHandRef.current has just completed its layout animation.
      const settledId = prevCardIdMovingToHandRef.current!;
      setPermanentlySettledCardIds(prevSet => {
        const newSet = new Set(prevSet);
        newSet.add(settledId);
        console.log(`[SwapAnimLayout DEBUG] SETTLED_LOG: Added ${settledId} to permanentlySettledCardIds. New set:`, Array.from(newSet));
        return newSet;
      });

      if (cardArrivingFromHolding && cardArrivingFromHolding.id === settledId) {
        setSettledCardFullData(prevMap => {
            const newMap = new Map(prevMap);
            newMap.set(settledId, cardArrivingFromHolding);
            console.log(`[SwapAnimLayout DEBUG] LATCH_DATA: Latched data for ${settledId}. New map size: ${newMap.size}`);
            return newMap;
        });
      }
    }
  }, [cardIdMovingToHand, cardArrivingFromHolding]); // Added cardArrivingFromHolding dependency

  useEffect(() => {
    // Clean up IDs from permanentlySettledCardIds if they are no longer in hand
    // or if they are starting a new layout animation (i.e., they become cardIdMovingToHand again).
    const currentHandIds = new Set(actualHandForDisplay.map(c => c ? c.id : null).filter(Boolean) as string[]);
    
    setPermanentlySettledCardIds(currentSettledIds => {
      let changed = false;
      const newSet = new Set(currentSettledIds);
      for (const id of currentSettledIds) {
        if (!currentHandIds.has(id) || id === cardIdMovingToHand) {
          newSet.delete(id);
          changed = true;
          console.log(`[SwapAnimLayout DEBUG] SETTLED_LOG: Removed ${id} from permanentlySettledCardIds (Reason: ${!currentHandIds.has(id) ? 'not in hand' : 're-animating'}). New set:`, Array.from(newSet));
        }
      }
      return changed ? newSet : currentSettledIds;
    });

    setSettledCardFullData(currentMap => {
        let mapChanged = false;
        const newMap = new Map(currentMap);
        for (const id of currentMap.keys()) {
            if (!currentHandIds.has(id) || id === cardIdMovingToHand) {
                if (newMap.delete(id)) {
                    mapChanged = true;
                    console.log(`[SwapAnimLayout DEBUG] LATCH_DATA: Removed latched data for ${id} (Reason: ${!currentHandIds.has(id) ? 'not in hand' : 're-animating'}). New map size: ${newMap.size}`);
                }
            }
        }
        return mapChanged ? newMap : currentMap;
    });
  }, [actualHandForDisplay, cardIdMovingToHand]);

  // Effect to manage the flip sequence
  useEffect(() => {
    if (cardIdMovingToHand === null && prevCardIdMovingToHandRef.current) {
      // Card animation to hand has just ended
      const justFinishedCardId = prevCardIdMovingToHandRef.current;
      console.log(`[SwapAnimLayout DEBUG] FLIP_SEQ: Card ${justFinishedCardId} landed. Starting stabilization period.`);
      
      // Add to permanently settled cards without delay
      setPermanentlySettledCardIds(prev => {
        const newSet = new Set(prev);
        newSet.add(justFinishedCardId);
        return newSet;
      });
      
      // Save the card data immediately to prevent flicker
      if (cardArrivingFromHolding && cardArrivingFromHolding.id === justFinishedCardId) {
        setSettledCardFullData(prev => {
          const newMap = new Map(prev);
          newMap.set(justFinishedCardId, cardArrivingFromHolding);
          return newMap;
        });
      }
      
      // Delay setting the card to mid-flip state to avoid immediate visual change
      setTimeout(() => {
        setCardIdMidFlip(justFinishedCardId);
      }, 10); // Reduced from 50ms to 10ms for faster flip start
    } 
    else if (cardIdMidFlip && cardIdMovingToHand === cardIdMidFlip) {
      // If a new animation starts for the card that was mid-flip, cancel mid-flip state
      setCardIdMidFlip(null);
    }
    
    // Update reference for next comparison
    prevCardIdMovingToHandRef.current = cardIdMovingToHand;
  }, [cardIdMovingToHand, cardIdMidFlip, cardArrivingFromHolding]);

  // Effect to clear the "mid-flip" state after the flip animation duration
  useEffect(() => {
    if (!cardIdMidFlip) return;
    
    console.log(`[SwapAnimLayout DEBUG] FLIP_SEQ: Card ${cardIdMidFlip} is mid-flip. Scheduling clear in ${FLIP_ANIMATION_DURATION_MS}ms.`);
    const timer = setTimeout(() => {
      console.log(`[SwapAnimLayout DEBUG] FLIP_SEQ: Clearing mid-flip state for ${cardIdMidFlip} after timeout.`);
      setCardIdMidFlip(null);
    }, FLIP_ANIMATION_DURATION_MS); // Reduced from 100ms extra to 30ms for smoother transition
    
    return () => clearTimeout(timer);
  }, [cardIdMidFlip]);

  // Effect for permanentlySettledCardIds (ensure this integrates or is correctly replaced)
  useEffect(() => {
    if (cardIdMovingToHand === null && prevCardIdMovingToHandRef.current) {
      const settledId = prevCardIdMovingToHandRef.current;
      setPermanentlySettledCardIds(prev => new Set(prev).add(settledId));
    }
    // prevCardIdMovingToHandRef is updated in the other useEffect now
  }, [cardIdMovingToHand]);

  if (!playerState) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>Loading player data...</div>;
  }

  if (!actualHandForDisplay) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>Hand data missing.</div>;
  }

  const isCardBeingPeeked = (handCard: ClientCard | null, handCardIndex: number): boolean => {
    if (!isInitialPeekActive || !cardsBeingPeeked || !handCard) {
      return false;
    }

    // 'handCard' for the viewing player can be a HiddenCard object from their hand.
    // It has an 'id'.
    // 'cardsBeingPeeked' is an array of actual Card objects (with rank, suit, id).
    // We need to see if any card in 'cardsBeingPeeked' matches the 'id' of the 'handCard'.

    const handCardId = handCard.id; // All ClientCard types have an id.

    return cardsBeingPeeked.some(peekedCard => {
        // peekedCard is a full Card object.
        if ('isHidden' in peekedCard) return false; // Should not happen, cardsBeingPeeked are full cards.
        return peekedCard.id === handCardId;
    });
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

  const DEFAULT_LAYOUT_TRANSITION_CONFIG = cardContainerVariants.layoutTransition;
  const LAYOUT_SPRING_CONFIG = { type: "spring", stiffness: 170, damping: 25 };

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
          layout
          transition={cardContainerVariants.layoutTransition}
        >
          <AnimatePresence mode="popLayout">
            {visualGridCells.map((cellCard, cellIndex) => {
              const originalCardIndex = cellCard ? actualHandForDisplay.findIndex(c => {
                if (!cellCard) return false;
                if (('isHidden' in c && 'isHidden' in cellCard && c.id === cellCard.id) || 
                    (!('isHidden' in c) && !('isHidden' in cellCard) && c.id === cellCard.id)) {
                  return true;
                }
                return false;
              }) : -1;

              const cardIsPresentInHand = originalCardIndex !== -1;
              const currentCardId = cellCard?.id;

              let determinadoLayoutId: string | undefined = undefined;
              if (currentCardId) { 
                if (currentCardId === cardIdMovingToHand) {
                  determinadoLayoutId = `card-anim-${currentCardId}`;
                } else if (currentCardId === cardIdMovingToDiscard) {
                  determinadoLayoutId = `card-anim-${currentCardId}`;
                }
              }
              console.log(`[SwapAnimLayout DEBUG] INITIAL SET: Card ${currentCardId}: determinadoLayoutId=${determinadoLayoutId}, isDiscard=${currentCardId === cardIdMovingToDiscard}`);

              // Capture information at definition time for onLayoutAnimationComplete
              const idOfCardInSlotThisRender = currentCardId;
              const wasLayoutTargetForArrivalThisRender = !!(determinadoLayoutId && currentCardId && currentCardId === cardIdMovingToHand);
              const wasLayoutTargetForDepartureThisRender = !!(determinadoLayoutId && currentCardId && currentCardId === cardIdMovingToDiscard);
              const originalCIdMTH_atDefinition = cardIdMovingToHand; // Capture prop value at definition
              const originalCIdMTD_atDefinition = cardIdMovingToDiscard; // Capture prop value at definition

              const isArrivingLayout = cardIdMovingToHand === currentCardId;
              let cardToDisplay: ClientCard | null = cellCard;
              let showFaceUp = false;

              if (cellCard && cardIsPresentInHand) {
                if (isViewingPlayer) {
                  // A. During the layout animation of an arriving card (it's "flying in")
                  if (isArrivingLayout && cardArrivingFromHolding && cardArrivingFromHolding.id === currentCardId) {
                    cardToDisplay = cardArrivingFromHolding; // Use the full data of the card from holding
                    showFaceUp = true; // Show it face-up *during* its travel animation
                  }
                  // B. Card has settled, or was never part of the layout animation
                  else {
                    // Standard logic for determining face-up status for cards in hand
                    if (isCardBeingPeeked(cellCard, originalCardIndex)) {
                      const actualCardDataFromPeek = cardsBeingPeeked?.find(
                        (peekedCard) => !('isHidden' in peekedCard) && peekedCard.id === cellCard.id
                      );
                      if (actualCardDataFromPeek) {
                        cardToDisplay = actualCardDataFromPeek;
                      } else {
                        console.warn(`[PlayerHandComponent] Card ${cellCard.id} was marked for peek, but full data not found in cardsBeingPeeked.`);
                      }
                      showFaceUp = true;
                    } else if (cardsToForceShowFaceUp[originalCardIndex]) {
                      showFaceUp = true;
                      // cardToDisplay remains cellCard. If cellCard is HiddenCard, CardComponent shows "privately hidden".
                    } else if (!('isHidden' in cellCard)) { // If the card from actualHandForDisplay is already a full card
                      cardToDisplay = cellCard;
                      showFaceUp = true;
                    }
                    // else, cardToDisplay is cellCard (which might be HiddenCard), and showFaceUp remains false.
                  }
                } else { // Opponent's hand
                  if (cellCard && !('isHidden' in cellCard)) {
                    cardToDisplay = cellCard;
                    showFaceUp = true;
                  }
                }
              }

              const isSelectedForSingleAction = cardIsPresentInHand && selectedCardIndices.includes(originalCardIndex);
              const isSelectedForMultiAction = cardIsPresentInHand && multiSelectedCardIndices.includes(originalCardIndex);

              const isThisCardSwappingOut = !!(swappingOutCardId && cellCard && cellCard.id === swappingOutCardId);
              
              // Check if this card is being targeted by a global ability
              const currentGlobalTarget = cardIsPresentInHand ? abilityTargetsOnThisHand?.find(target => target.cardIndex === originalCardIndex) : undefined;
              const isBeingTargetedForPeek = currentGlobalTarget?.type === 'peek';
              const isBeingTargetedForSwap = currentGlobalTarget?.type === 'swap';
              
              // Logging for opponent peek (can be removed after debugging)
              if (!isViewingPlayer && showFaceUp && cardIsPresentInHand) {
                console.log(`[PlayerHandComponent-OPPONENT-PEEK-DEBUG] Key: ${`player-${playerID}-slot-${cellIndex}`}`, {
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
              const isBeingSwappedByPlayer = swappingOutCardId === currentCardId;

              // Determine if this specific card should get the temporary swap highlight
              const showSwapHighlight = !isViewingPlayer && highlightedSwapIndex === originalCardIndex;

              let cardWrapperClassName = "relative w-16 md:w-20 aspect-[2.5/3.5] overflow-hidden rounded-lg";

              if (isSelectedForSingleAction || isSelectedForMultiAction) {
                cardWrapperClassName += " ring-2 ring-accent ring-offset-2 ring-offset-neutral-800";
              }

              const cardKey = cellCard ? cellCard.id : `player-${playerID}-empty-slot-${cellIndex}`;
              const cardExitProp = (currentCardId && currentCardId === cardIdMovingToDiscard) ? undefined : "normalExit";
              
              const wasArrivingLayoutPreviousRender = useRef(false);
              const justFinishedLayoutArrival = wasArrivingLayoutPreviousRender.current && !isArrivingLayout && !cardIdMovingToHand;

              if (isArrivingLayout) {
                wasArrivingLayoutPreviousRender.current = true;
              } else {
                if (cardIdMovingToHand !== currentCardId) {
                   wasArrivingLayoutPreviousRender.current = false;
                }
              }
              
              const isMidFlipVisualPhase = cardIdMidFlip === currentCardId;

              let slotInitial: MotionProps['initial'] = "initial";
              let slotAnimate: MotionProps['animate'] = "animate";
              let slotTransition: MotionProps['transition'] = determinadoLayoutId ? LAYOUT_SPRING_CONFIG : DEFAULT_LAYOUT_TRANSITION_CONFIG;

              if (isArrivingLayout) {
                if (cardArrivingFromHolding && cardArrivingFromHolding.id === currentCardId) {
                  cardToDisplay = cardArrivingFromHolding;
                }
                showFaceUp = true;
              } else if (justFinishedLayoutArrival) {
                console.log(`[SwapAnimLayout DEBUG] FLIP_SEQ: SNAP RENDER for ${currentCardId}.`);
                if (cardArrivingFromHolding && cardArrivingFromHolding.id === currentCardId) {
                  cardToDisplay = cardArrivingFromHolding;
                } else {
                  cardToDisplay = cellCard; 
                }
                showFaceUp = true; 
                slotInitial = false;
                slotAnimate = { opacity: 1, y: 0 };
                slotTransition = { duration: 0 };
              } else if (isMidFlipVisualPhase) {
                console.log(`[SwapAnimLayout DEBUG] FLIP_SEQ: MID-FLIP RENDER for ${currentCardId}.`);
                if (cardArrivingFromHolding && cardArrivingFromHolding.id === currentCardId) {
                  cardToDisplay = cardArrivingFromHolding;
                } else {
                  cardToDisplay = cellCard; 
                }
                showFaceUp = true; 
                slotInitial = false; 
                slotAnimate = { opacity: 1, y: 0 }; 
                slotTransition = cardContainerVariants.layoutTransition;
              } else {
                // This is the final 'else' for rendering a card just sitting in hand.
                // It's not arriving, not just finished, not mid-flip.
                // We will now always use variants for its base animation config.
                // The cardToDisplay and showFaceUp logic for settled cards is still important for visuals.

                const isPermanentlySettled = currentCardId && permanentlySettledCardIds.has(currentCardId);

                if (isPermanentlySettled && currentCardId) {
                  const latchedData = settledCardFullData.get(currentCardId);
                  if (latchedData) {
                    console.log(`[SwapAnimLayout DEBUG] FLICKER_FIX: PlayerHand SETTLED RENDER for ${currentCardId} using latched data (Will use variants for base anim).`);
                    cardToDisplay = latchedData;
                    showFaceUp = true; 
                  } else {
                    console.log(`[SwapAnimLayout DEBUG] FLICKER_FIX: PlayerHand SETTLED RENDER for ${currentCardId} - NO LATCHED DATA (Will use variants for base anim).`);
                    cardToDisplay = cellCard; // Fallback
                    // Standard showFaceUp logic for a settled card if no latched data, but it should exist
                    const isCardOriginallyHidden = cellCard && 'isHidden' in cellCard && cellCard.isHidden;
                    const isCardEffectivelyPeeked = isCardBeingPeeked(cellCard, originalCardIndex);
                    const isCardForcedFaceUp = cardsToForceShowFaceUp[originalCardIndex];
                    if (isCardEffectivelyPeeked) {
                      showFaceUp = true;
                      if (cellCard && 'isHidden' in cellCard && cardsBeingPeeked) {
                        const peekedCardDataTemporary = cardsBeingPeeked.find(
                          (peekedCard) => !('isHidden' in peekedCard) && peekedCard.id === cellCard.id
                        );
                        if (peekedCardDataTemporary) cardToDisplay = peekedCardDataTemporary;
                      }
                    } else if (isCardForcedFaceUp) {
                      showFaceUp = true;
                    } else {
                      showFaceUp = !isCardOriginallyHidden;
                    }
                  }
                } else {
                  // Not permanently settled, and not in any other special animation phase.
                  cardToDisplay = cellCard;
                  const isCardOriginallyHidden = cellCard && 'isHidden' in cellCard && cellCard.isHidden;
                  const isCardEffectivelyPeeked = isCardBeingPeeked(cellCard, originalCardIndex);
                  const isCardForcedFaceUp = cardsToForceShowFaceUp[originalCardIndex];
                  if (isCardEffectivelyPeeked) {
                    showFaceUp = true;
                     if (cellCard && 'isHidden' in cellCard && cardsBeingPeeked) {
                        const peekedCardDataTemporary = cardsBeingPeeked.find(
                          (peekedCard) => !('isHidden' in peekedCard) && peekedCard.id === cellCard.id
                        );
                        if (peekedCardDataTemporary) cardToDisplay = peekedCardDataTemporary;
                      }
                  } else if (isCardForcedFaceUp) {
                    showFaceUp = true;
                  } else {
                    showFaceUp = !isCardOriginallyHidden;
                  }
                }
                
                // ALWAYS use variants for cards not in active layout transition phases.
                slotInitial = "initial"; 
                slotAnimate = "animate";
                slotTransition = cardContainerVariants.layoutTransition; // Default transition from variants
              }
              
              // Maintain face-up appearance during flip animation to prevent "privately hidden" flash
              if (isMidFlipVisualPhase && cardArrivingFromHolding && cardArrivingFromHolding.id === currentCardId) {
                cardToDisplay = cardArrivingFromHolding;
                showFaceUp = true;
              }

              if (isViewingPlayer && cellCard?.id && (cellCard.id === cardIdMovingToHand || prevCardIdMovingToHandRef.current === cellCard.id || cardIdMidFlip === cellCard.id || (settledCardFullData.has(cellCard.id) && !cardIdMovingToHand && !cardIdMidFlip))) { // Enhanced logging condition
                const logPlayerId = playerID.length > 10 ? playerID.substring(playerID.length - 6) : playerID;
                console.log(
                  `[SwapAnimLayout DEBUG] FLICKER_CHECK: PlayerHand (Target: ${prevCardIdMovingToHandRef.current || cardIdMovingToHand || cardIdMidFlip || 'N/A'}, LoggedFor: ${cellCard.id}): ` +
                    `Player: ${logPlayerId}, CIdMTH: ${cardIdMovingToHand}, PrevCIdMTH: ${prevCardIdMovingToHandRef.current}, ` +
                    `layoutId: ${determinadoLayoutId || '-'}, initial: ${JSON.stringify(slotInitial)}, animate: ${JSON.stringify(slotAnimate)}, trans: ${JSON.stringify(slotTransition)}, ` +
                    `justFinished: ${justFinishedLayoutArrival}, midFlip: ${isMidFlipVisualPhase}, ` +
                    `cell: ${cellCard?.id}(${cellCard ? ('isHidden' in cellCard ? 'H' : 'F') : 'N/A'}), ` +
                    `display: ${cardToDisplay ? ( (!('isHidden' in cardToDisplay) && cardToDisplay.rank && cardToDisplay.suit) ? `${cardToDisplay.rank}${cardToDisplay.suit}` : `Hidden(${cardToDisplay.id})` ) : 'N/A'}, ` +
                    `showFaceUp: ${showFaceUp}`
                );
              }

              let motionInitialConfig: MotionProps['initial'] = "initial";
              let motionAnimateConfig: MotionProps['animate'] = "animate";
              let motionVariantsConfig = cardContainerVariants;
              let motionCustomConfig: any = isThisCardSwappingOut; // isThisCardSwappingOut is for a different type of swap
              let motionTransitionConfig: MotionProps['transition'] = cardContainerVariants.layoutTransition;
              let cardSpecificExitProp: MotionProps['exit'] = cardExitProp; // cardExitProp is 'undefined' or 'normalExit'

              // **Explicit override for card moving to discard**
              if (currentCardId && currentCardId === cardIdMovingToDiscard) {
                console.log(`[SwapAnimLayout DEBUG] PlayerHand DEPARTING OVERRIDE (Phase 1) for ${currentCardId}, determinadoLayoutId=${determinadoLayoutId}`);
                determinadoLayoutId = `card-anim-${currentCardId}`; // Ensure it's set
                console.log(`[SwapAnimLayout DEBUG] AFTER OVERRIDE: Card ${currentCardId}: determinadoLayoutId=${determinadoLayoutId}`);
                motionAnimateConfig = { 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  rotate: 0,
                  zIndex: 200 // Very high z-index to ensure visibility
                };
                cardSpecificExitProp = undefined; // Changed from minimal exit prop to undefined for layout animation
                motionVariantsConfig = undefined as any;
                motionCustomConfig = undefined;
                motionTransitionConfig = { 
                  type: "spring", 
                  stiffness: 120, // Reduced for more dramatic animation
                  damping: 18,  // Reduced for more dramatic animation
                  mass: 1.0,
                  restDelta: 0.001,
                  restSpeed: 0.001
                }; 
                console.log(`[SwapAnimLayout DEBUG] PlayerHand DEPARTING OVERRIDE (Phase 2) for ${currentCardId}: initial=UNDEFINED_OR_DEFAULT, animate=${JSON.stringify(motionAnimateConfig)}, exit=${cardSpecificExitProp}, variants=undefined, custom=undefined, transition=${JSON.stringify(motionTransitionConfig)}`);
              }
              // This block is now mutually exclusive with the one above if cardIdMovingToDiscard matches.
              else if (determinadoLayoutId) { 
                // This applies to cardIdMovingToHand or other generic layout ID cases if any
                console.log(`[SwapAnimLayout DEBUG] ELSE-IF BLOCK: Card ${currentCardId}: determinadoLayoutId=${determinadoLayoutId}`);
                motionTransitionConfig = { type: "spring", stiffness: 170, damping: 25 };
                motionInitialConfig = false;
                motionAnimateConfig = { opacity: 1, y: 0, scale: 1, rotate: 0 }; // Ensure all transform props are neutral

                if (currentCardId && currentCardId === cardIdMovingToHand) {
                  // Specific overrides for the card ARRIVING in the hand via layoutId
                   motionVariantsConfig = undefined as any; 
                   motionCustomConfig = undefined;
                   cardSpecificExitProp = "normalExit"; // Arriving card should have a normal exit if it's subsequently removed
                }
              } else {
                console.log(`[SwapAnimLayout DEBUG] FINAL ELSE BLOCK: Card ${currentCardId}: determinadoLayoutId=${determinadoLayoutId}`);
                // If not a layout-driven animation, ensure exit is not accidentally undefined
                // unless it's the specific swappingOutCardId case (which has its own variant)
                if (cardSpecificExitProp === undefined && !(currentCardId && currentCardId === swappingOutCardId)) {
                    cardSpecificExitProp = "normalExit";
                }
              }

              // FINAL SAFETY CHECK - Ensure departing card always has layoutId set
              if (currentCardId && currentCardId === cardIdMovingToDiscard) {
                const finalLayoutId = `card-anim-${currentCardId}`;
                if (determinadoLayoutId !== finalLayoutId) {
                  console.log(`[SwapAnimLayout DEBUG] CRITICAL FIX: Layout ID for departing card ${currentCardId} was reset to ${determinadoLayoutId}! Restoring to ${finalLayoutId}`);
                  determinadoLayoutId = finalLayoutId;
                }
              }
              
              console.log(`[SwapAnimLayout DEBUG] FINAL BEFORE RENDER: Card ${currentCardId}: determinadoLayoutId=${determinadoLayoutId}, isDiscard=${currentCardId === cardIdMovingToDiscard}`);

              return (
                <motion.div
                  key={cardKey}
                  layout
                  layoutId={determinadoLayoutId}
                  variants={motionVariantsConfig}
                  initial={currentCardId && currentCardId === cardIdMovingToDiscard ? undefined : motionInitialConfig}
                  animate={motionAnimateConfig}
                  exit={cardSpecificExitProp}
                  custom={motionCustomConfig}
                  transition={motionTransitionConfig}
                  onAnimationStart={() => {
                    if (determinadoLayoutId && cellCard) {
                      if (cellCard.id === cardIdMovingToHand) {
                        console.log(`[SwapAnimLayout DEBUG] PlayerHand CARD ANIMATION START (Arriving Card ID: ${cellCard.id}): cardIdMovingToHand_PROP=${cardIdMovingToHand}, determinedLayoutId=${determinadoLayoutId}`);
                      } else if (cellCard.id === cardIdMovingToDiscard) {
                        console.log(`[SwapAnimLayout DEBUG] PlayerHand CARD ANIMATION START (Departing Card ID: ${cellCard.id}): cardIdMovingToDiscard_PROP=${cardIdMovingToDiscard}, determinedLayoutId=${determinadoLayoutId}`);
                      }
                    }
                  }}
                  onLayoutAnimationComplete={() => {
                    // Use captured values from the render scope of this motion.div
                    // determinadoLayoutId is from closure, idOfCardInSlotThisRender, wasLayoutTargetForArrivalThisRender, wasLayoutTargetForDepartureThisRender are from closure.
                    // cardIdMovingToHand & cardIdMovingToDiscard accessed here are the *current* props of PlayerHandComponent when the callback executes.
                    if (determinadoLayoutId && idOfCardInSlotThisRender) {
                      if (wasLayoutTargetForArrivalThisRender) {
                        console.log(`[SwapAnimLayout DEBUG] PlayerHand CARD LAYOUT ANIMATION COMPLETE (Arrived Card ID: ${idOfCardInSlotThisRender}): DefTime CIdMTH=${originalCIdMTH_atDefinition}, CallbackTime CIdMTH=${cardIdMovingToHand}, layoutId=${determinadoLayoutId}`);
                      } else if (wasLayoutTargetForDepartureThisRender) {
                        console.log(`[SwapAnimLayout DEBUG] PlayerHand CARD LAYOUT ANIMATION COMPLETE (Departed Card ID: ${idOfCardInSlotThisRender}): DefTime CIdMTD=${originalCIdMTD_atDefinition}, CallbackTime CIdMTD=${cardIdMovingToDiscard}, layoutId=${determinadoLayoutId}`);
                      }
                    }
                  }}
                  className={cardWrapperClassName}
                  style={{
                    zIndex: currentCardId === cardIdMovingToDiscard ? 200 : (currentCardId === cardIdMovingToHand ? 90 : 'auto'),
                    filter: currentCardId === cardIdMovingToDiscard ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : 'none',
                    position: currentCardId === cardIdMovingToDiscard ? 'relative' : 'relative',
                    transformOrigin: 'center center'
                  }}
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
                      card={cardToDisplay}
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