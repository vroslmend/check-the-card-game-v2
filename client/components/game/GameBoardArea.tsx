import React from 'react';
import { Card } from 'shared-types';
import { PlayingCard } from '../cards/PlayingCard';

interface GameBoardAreaProps {
  deckSize: number;
  discardPileTopCard: Card | null;
  onDeckClick?: () => void;
  onDiscardClick?: () => void;
  className?: string;
  canDrawFromDeck?: boolean;
  canDrawFromDiscard?: boolean;
}

const GameBoardArea: React.FC<GameBoardAreaProps> = ({
  deckSize,
  discardPileTopCard,
  onDeckClick,
  onDiscardClick,
  className,
  canDrawFromDeck = true,
  canDrawFromDiscard = true,
}) => {
  const deckClickableStyle = canDrawFromDeck && onDeckClick ? 'cursor-pointer hover:ring-2 hover:ring-green-500' : 'cursor-not-allowed';
  const discardClickableStyle = canDrawFromDiscard && discardPileTopCard && onDiscardClick ? 'cursor-pointer hover:ring-2 hover:ring-yellow-500' : discardPileTopCard ? '' : 'cursor-not-allowed';

  return (
    <div className={`flex items-center justify-center space-x-8 p-4 bg-gray-200 rounded-lg shadow-inner ${className || ''}`}>
      {/* Deck Area */}
      <div className="flex flex-col items-center">
        <div 
          className={`relative ${deckClickableStyle}`}
          onClick={canDrawFromDeck ? onDeckClick : undefined}
        >
          <PlayingCard isFaceDown={true} layoutId="deck-back" canInteract={!!onDeckClick && canDrawFromDeck} />
          {deckSize > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full px-2 py-1 shadow-md">
              {deckSize}
            </span>
          )}
        </div>
        <span className="mt-2 text-sm font-medium text-gray-700">Deck</span>
      </div>

      {/* Discard Pile Area */}
      <div className="flex flex-col items-center">
        <div 
          className={`relative ${discardClickableStyle}`}
          onClick={canDrawFromDiscard && discardPileTopCard ? onDiscardClick : undefined}
        >
          {discardPileTopCard ? (
            <PlayingCard 
              layoutId={`${discardPileTopCard.rank}-${discardPileTopCard.suit}`} 
              card={discardPileTopCard} 
              canInteract={!!onDiscardClick && canDrawFromDiscard}
            />
          ) : (
            <div className="w-32 h-48 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-100">
              <span className="text-gray-400 text-sm">Empty</span>
            </div>
          )}
        </div>
        <span className="mt-2 text-sm font-medium text-gray-700">Discard Pile</span>
      </div>
    </div>
  );
};

export default GameBoardArea;