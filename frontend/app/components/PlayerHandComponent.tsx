import React from 'react';
import type { Card, ClientCard, ClientPlayerState } from 'shared-types';
import CardComponent from './CardComponent';

interface PlayerHandComponentProps {
  playerID: string;
  playerName?: string;
  playerState: ClientPlayerState | undefined; // Full player state for context if needed
  actualHandForDisplay: ClientCard[]; // The hand to render (usually playerState.hand)
  isViewingPlayer: boolean;
  onCardClick?: (playerID: string, cardIndex: number) => void;
  selectedCardIndices?: number[];
  multiSelectedCardIndices?: number[];
  cardsToForceShowFaceUp?: { [cardIndex: number]: boolean };
  isLocked?: boolean;
  hasCalledCheck?: boolean;
  // New props for initial peek handling for the viewing player
  cardsBeingPeeked?: Card[] | null; 
  isInitialPeekActive?: boolean;
}

const PlayerHandComponent: React.FC<PlayerHandComponentProps> = ({
  playerID,
  playerName,
  playerState, // Keep for context like name, score, status, but not primary hand source here
  actualHandForDisplay, // Use this as the source for cards in the grid
  isViewingPlayer,
  onCardClick,
  selectedCardIndices = [],
  multiSelectedCardIndices = [],
  cardsToForceShowFaceUp = {},
  isLocked = false,
  hasCalledCheck = false,
  cardsBeingPeeked,
  isInitialPeekActive,
}) => {
  if (!playerState) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700' : 'text-gray-400'}`}>Loading {playerName || playerID.slice(-4)}...</div>;
  }

  // actualHandCards is now actualHandForDisplay, passed directly
  if (!actualHandForDisplay) {
    return <div className={`text-xs ${isViewingPlayer ? 'text-gray-700' : 'text-gray-400'}`}>Hand missing for {playerName || playerID.slice(-4)}.</div>;
  }

  const displaySlots = 4;

  const statusBadge = isLocked
    ? <span className="ml-1 text-gray-400 text-[0.6rem] align-middle" title="Locked" aria-label="Locked">🔒</span>
    : hasCalledCheck
      ? <span className="ml-1 text-amber-600 text-[0.6rem] align-middle" title="Called Check" aria-label="Called Check">✔️</span>
      : null;

  // Consistent hand area classes for all players for sizing and internal padding
  const handPadding = 'p-1'; // Use the most compact padding for all
  const handAreaClasses = [
    'mx-auto',
    handPadding,
    'rounded-lg md:rounded-xl',
    'shadow-sm',
    'bg-white/80',
    'backdrop-blur-sm',
    'flex', 'flex-col', 'items-center',
    isLocked ? 'opacity-60' : '',
    // Conditional background for hasCalledCheck can remain if desired for visual cue
    hasCalledCheck && !isLocked ? 'bg-amber-50/60' : '',
    'transition-all', 'duration-150',
    'w-fit',
  ].join(' ');

  // Player name font size still differentiates viewing player
  const playerNameFontSize = isViewingPlayer ? 'text-sm font-semibold md:text-base' : 'text-xs font-medium';
  // Consistent grid gap for all hands
  const gridGap = 'gap-1 md:gap-1.5'; // Use the most compact gap for all
  
  // Card width is already consistently small
  const cardWidth = 'w-12 md:w-14'; 

  return (
    <div className="mb-0.5"> {/* Consistent minimal margin-bottom for all hand components */} 
      <div className={`flex items-center justify-center mb-0.5`}> 
        <h4 className={`text-center font-sans ${playerNameFontSize} text-gray-700`}>
          {playerState.name || playerName || playerID.slice(-6)}
          {isViewingPlayer && <span className="ml-1 text-xs text-gray-500 font-normal">(You)</span>}
        </h4>
        {statusBadge}
      </div>
      <div
        className={handAreaClasses}
        aria-label={isViewingPlayer ? 'Your hand' : `${playerState.name || playerName || playerID}'s hand`}
      >
        <div
          className={`grid grid-cols-2 ${gridGap}`}
        >
          {Array.from({ length: displaySlots }).map((_, index) => {
            const clientCard = actualHandForDisplay[index];
            let cardForDisplay: ClientCard | null = clientCard || null;
            let showFaceUp = false;

            if (isViewingPlayer) {
              if (cardForDisplay && !('isHidden' in cardForDisplay && cardForDisplay.isHidden)) {
                const actualCard = cardForDisplay as Card;
                if (isInitialPeekActive && cardsBeingPeeked) {
                  showFaceUp = cardsBeingPeeked.some(peekedCard =>
                    peekedCard.rank === actualCard.rank && peekedCard.suit === actualCard.suit
                  );
                } else if (cardsToForceShowFaceUp[index]) {
                  showFaceUp = true;
                }
              }
            } else {
              if (cardForDisplay && cardsToForceShowFaceUp[index] && !('isHidden' in cardForDisplay && cardForDisplay.isHidden)) {
                showFaceUp = true;
              } else {
                showFaceUp = false;
              }
            }

            return (
              <div key={`${playerID}-card-slot-${index}`} className={`${cardWidth}`}>
                <CardComponent
                  card={cardForDisplay}
                  isFaceUp={showFaceUp}
                  onClick={onCardClick && clientCard ? () => onCardClick(playerID, index) : undefined}
                  isSelected={selectedCardIndices.includes(index) || multiSelectedCardIndices.includes(index)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlayerHandComponent; 