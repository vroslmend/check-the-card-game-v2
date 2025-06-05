import React from 'react';
import { ClientCard } from '../../../shared-types/src/index';
import CardDisplay from '../ui/CardDisplay';

interface PlayerHandProps {
  cards: ClientCard[];
  isViewingPlayer?: boolean; // True if this hand belongs to the player viewing the screen
  onCardClick?: (cardId: string, cardIndex: number) => void;
  selectedCardId?: string | null;
  className?: string;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  isViewingPlayer = true, // Default to true, meaning cards are face up unless explicitly hidden
  onCardClick,
  selectedCardId,
  className,
}) => {
  return (
    <div className={`grid grid-cols-2 gap-x-2 gap-y-3 p-2 bg-gray-700 rounded-lg shadow ${className || ''} max-w-xs mx-auto`}>
      {cards.map((card, index) => (
        <CardDisplay
          key={card.id} // Assuming ClientCard always has a unique id
          card={card} // If isViewingPlayer is false, CardDisplay should handle showing backs for opponent cards
          onClick={onCardClick ? () => onCardClick(card.id, index) : undefined}
          isSelected={selectedCardId === card.id}
        />
      ))}
      {cards.length === 0 && (
        <div className="text-gray-500 italic">Hand is empty</div>
      )}
    </div>
  );
};

export default PlayerHand; 