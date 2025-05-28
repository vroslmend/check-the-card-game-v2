import React from 'react';
import type { Card, PlayerState } from 'shared-types';
import CardComponent from './CardComponent';

interface PlayerHandComponentProps {
  playerID: string;
  playerState: PlayerState | undefined;
  isCurrentPlayerBoard: boolean; // True if this hand component is for the currently viewing player
  onCardClick?: (playerID: string, cardIndex: number) => void;
  selectedCardIndices?: number[];
  // For the current player, which of their own cards should be shown face up
  // (e.g. after peeking, or if a game rule reveals them temporarily)
  currentPlayersCardsToShowFaceUp?: { [cardIndex: number]: boolean };
  // For other players, this would be based on G.players[otherPlayerID].hand[cardIndex].isPublic (if that existed)
  // or other game logic that makes an opponent's card public.
  // For now, we assume opponent cards are only shown if the whole card object is there (not {isHidden: true})
}

const PlayerHandComponent: React.FC<PlayerHandComponentProps> = ({
  playerID, // The ID of the player whose hand this is
  playerState,
  isCurrentPlayerBoard, // Is this hand component for the active client player?
  onCardClick,
  selectedCardIndices = [],
  currentPlayersCardsToShowFaceUp = {},
}) => {
  if (!playerState || !playerState.hand) {
    return <div>Loading player (ID: {playerID}) hand...</div>;
  }

  const hand = playerState.hand; // This will be Card[] or {isHidden: true}[]

  const numCards = hand.length;
  const numCols = numCards <= 2 ? numCards : 2; // Max 2 columns
  const numRows = Math.ceil(numCards / numCols);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${numCols}, auto)`,
    gridTemplateRows: `repeat(${numRows}, auto)`,
    gap: '10px',
    maxWidth: numCols * 80 + (numCols - 1) * 10 + 'px', // Card width (70) + padding/border + gap
    margin: '0 auto',
    border: isCurrentPlayerBoard ? '2px solid dodgerblue' : '1px solid lightgray',
    padding: '10px',
    borderRadius: '5px',
    minHeight: '220px', // Accommodate 2 rows of cards + padding
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ textAlign: 'center' }}>
        Player {playerID} {isCurrentPlayerBoard ? "(Your Hand)" : ""}
      </h3>
      <div style={gridStyle}>
        {hand.map((cardOrHidden, index) => {
          let cardToDisplay: Card | null = null;
          let isFaceUp = false;

          if ('isHidden' in cardOrHidden) {
            // This is an opponent's card, as transformed by playerView
            cardToDisplay = null; // No card details available
            isFaceUp = false; // Always face down
          } else {
            // This is a Card object from the player's own hand or a publicly known card
            cardToDisplay = cardOrHidden as Card; // Type assertion
            // For the current player's board, show face up if in currentPlayersCardsToShowFaceUp
            // Otherwise, assume face down (e.g. player knows it but it's not revealed to others)
            // If not the current player's board but we have card data, it implies it's public.
            isFaceUp = isCurrentPlayerBoard ? !!currentPlayersCardsToShowFaceUp[index] : true;
          }
          
          return (
            <CardComponent
              key={`${playerID}-card-${index}`}
              card={cardToDisplay}
              isFaceUp={isFaceUp}
              onClick={() => onCardClick && onCardClick(playerID, index)}
              isSelected={selectedCardIndices.includes(index)}
            />
          );
        })}
        {/* Render empty slots if hand is less than 4 to maintain 2x2 structure initially */}
        {numCards < 4 && Array.from({ length: 4 - numCards }).map((_, i) => (
             <CardComponent key={`${playerID}-empty-${i}`} card={null} />
        ))}
      </div>
    </div>
  );
};

export default PlayerHandComponent; 