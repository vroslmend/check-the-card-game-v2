import React from 'react';
import { Button } from '@/components/ui/button';

interface InitialPeekActionsProps {
  showReadyForPeekButton: boolean;
  isWaitingForPeekConfirmation: boolean;
  peekableCards: any[] | null;
  showAcknowledgePeekButton: boolean;
  isWaitingForPostPeekGameState: boolean;
  onReadyForPeek: () => void;
  onAcknowledgePeek: () => void;
}

const InitialPeekActions: React.FC<InitialPeekActionsProps> = ({
  showReadyForPeekButton,
  isWaitingForPeekConfirmation,
  peekableCards,
  showAcknowledgePeekButton,
  isWaitingForPostPeekGameState,
  onReadyForPeek,
  onAcknowledgePeek,
}) => {
  return (
    <div className="w-full flex items-center justify-between">
      <div className="prompt-text-area text-lg font-semibold">
        {showReadyForPeekButton && "When you are ready, click the button to see your initial two cards."}
        {isWaitingForPeekConfirmation && <span className="animate-pulse">Waiting for server...</span>}
        {peekableCards && "Memorize these two cards. They will be hidden again when the game starts."}
        {isWaitingForPostPeekGameState && <span className="animate-pulse">Waiting for other players to finish peeking...</span>}
      </div>
      <div className="action-buttons-area">
        {showReadyForPeekButton && (
          <Button onClick={onReadyForPeek} size="lg">
            Ready to Peek
          </Button>
        )}
        {showAcknowledgePeekButton && (
           <Button onClick={onAcknowledgePeek} size="lg" className="bg-green-600 hover:bg-green-700">
             Got It!
           </Button>
        )}
      </div>
    </div>
  );
};

export default InitialPeekActions; 