import React from 'react';
import { ClientCard } from 'shared-types';
import CardDisplay from '../ui/CardDisplay';

interface PlayerHandProps {
  hand: ClientCard[];
  onCardClick: (card: ClientCard, index: number) => void;
  localPlayerId: string;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ hand, onCardClick, localPlayerId }) => {
  return (
    <div className="bg-gray-700 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">Your Hand</h2>
      <div className="flex justify-center items-center space-x-2">
        {hand.length > 0 ? (
          hand.map((card, index) => (
            <div key={card.id} onClick={() => onCardClick(card, index)} className="cursor-pointer">
              <CardDisplay card={card} />
            </div>
          ))
        ) : (
          <p className="text-gray-400">No cards in hand.</p>
        )}
      </div>
    </div>
  );
};

export default PlayerHand;