import React from 'react';
import { Button } from '@/components/ui/button';

// This will be expanded with many more props later.
interface PlayerTurnActionsProps {
  onDrawFromDeck: () => void;
  onDrawFromDiscard: () => void;
}

const PlayerTurnActions: React.FC<PlayerTurnActionsProps> = ({
  onDrawFromDeck,
  onDrawFromDiscard,
}) => {
  return (
    <div className="w-full flex items-center justify-between">
      <div className="prompt-text-area text-lg font-semibold">
        It's your turn. Draw a card from the deck or the discard pile.
      </div>
      <div className="action-buttons-area flex space-x-4">
        <Button onClick={onDrawFromDeck} size="lg">
          Draw from Deck
        </Button>
        <Button onClick={onDrawFromDiscard} size="lg" variant="secondary">
          Draw from Discard
        </Button>
      </div>
    </div>
  );
};

export default PlayerTurnActions; 