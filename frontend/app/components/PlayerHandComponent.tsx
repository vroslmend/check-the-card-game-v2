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
    return <div>Loading player ({playerName || playerID}) data...</div>;
  }

  // actualHandCards is now actualHandForDisplay, passed directly
  if (!actualHandForDisplay) {
    return <div>Player ({playerName || playerID}) hand data is missing.</div>;
  }

  const displaySlots = 4;
  const numCols = displaySlots < 2 ? displaySlots : 2;
  const numRows = numCols > 0 ? Math.ceil(displaySlots / numCols) : 0;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${numCols}, minmax(70px, auto))`,
    gridTemplateRows: `repeat(${numRows}, auto)`,
    gap: '10px',
    margin: '0 auto',
    border: isViewingPlayer ? '2px solid dodgerblue' : '1px solid lightgray',
    padding: '10px',
    borderRadius: '5px',
    minHeight: numRows * 110 + 'px',
    backgroundColor: isLocked ? '#e0e0e0' : (hasCalledCheck ? '#fffacd' : 'transparent'),
  };

  return (
    <div style={{ marginBottom: '20px', opacity: isLocked ? 0.7 : 1 }}>
      {/* Player name and status display can use playerState directly */}
      <h4 style={{ textAlign: 'center', fontWeight: isViewingPlayer ? 'bold' : 'normal' }}>
        {playerState.name || playerName || playerID} 
        {isViewingPlayer && " (Your Hand)"}
        {isLocked && " (Locked)"}
        {hasCalledCheck && !isLocked && " (Called Check)"}
      </h4>
      <div style={gridStyle}>
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
          } else { // Opponent's hand
            if (cardForDisplay && cardsToForceShowFaceUp[index] && !('isHidden' in cardForDisplay && cardForDisplay.isHidden)) {
              showFaceUp = true;
            } else {
              showFaceUp = false;
            }
          }
          
          return (
            <CardComponent
              key={`${playerID}-card-${index}`}
              card={cardForDisplay}
              isFaceUp={showFaceUp}
              onClick={onCardClick && clientCard ? () => onCardClick(playerID, index) : undefined}
              isSelected={selectedCardIndices.includes(index) || multiSelectedCardIndices.includes(index)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlayerHandComponent; 