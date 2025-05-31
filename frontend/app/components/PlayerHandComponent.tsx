import React from 'react';
import type { Card, ClientCard, ClientPlayerState } from 'shared-types';
import CardComponent from './CardComponent';

interface PlayerHandComponentProps {
  playerID: string;
  playerName?: string;
  playerState: ClientPlayerState | undefined;
  handToShow?: ClientCard[];
  isViewingPlayer: boolean;
  onCardClick?: (playerID: string, cardIndex: number) => void;
  selectedCardIndices?: number[];
  multiSelectedCardIndices?: number[];
  cardsToForceShowFaceUp?: { [cardIndex: number]: boolean };
  isLocked?: boolean;
  hasCalledCheck?: boolean;
}

const PlayerHandComponent: React.FC<PlayerHandComponentProps> = ({
  playerID,
  playerName,
  playerState,
  handToShow,
  isViewingPlayer,
  onCardClick,
  selectedCardIndices = [],
  multiSelectedCardIndices = [],
  cardsToForceShowFaceUp = {},
  isLocked = false,
  hasCalledCheck = false,
}) => {
  if (!playerState) {
    return <div>Loading player ({playerName || playerID}) data...</div>;
  }

  const actualHandCards = handToShow || playerState.hand;

  if (!actualHandCards) {
    return <div>Player ({playerName || playerID}) hand data is missing.</div>;
  }

  const numActualCards = actualHandCards.length;

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
      <h4 style={{ textAlign: 'center', fontWeight: isViewingPlayer ? 'bold' : 'normal' }}>
        {playerName || playerID} 
        {isViewingPlayer && " (Your Hand)"}
        {isLocked && " (Locked)"}
        {hasCalledCheck && !isLocked && " (Called Check)"}
      </h4>
      <div style={gridStyle}>
        {actualHandCards.map((clientCard, index) => {
          let cardForDisplay: ClientCard | null = clientCard;
          let showFaceUp = false;

          if (isViewingPlayer) {
            if (cardsToForceShowFaceUp[index]) {
              showFaceUp = true;
            }
          } else {
            if (!('isHidden' in clientCard && clientCard.isHidden)) {
                 showFaceUp = true;
            }
            if (cardsToForceShowFaceUp[index]) {
                showFaceUp = true;
            }
          }
          
          return (
            <CardComponent
              key={`${playerID}-card-${index}`}
              card={cardForDisplay}
              isFaceUp={showFaceUp}
              onClick={onCardClick ? () => onCardClick(playerID, index) : undefined}
              isSelected={selectedCardIndices.includes(index) || multiSelectedCardIndices.includes(index)}
            />
          );
        })}
        {numActualCards < displaySlots && Array.from({ length: displaySlots - numActualCards }).map((_, i) => (
             <CardComponent key={`${playerID}-empty-${numActualCards + i}`} card={null} />
        ))}
      </div>
    </div>
  );
};

export default PlayerHandComponent; 