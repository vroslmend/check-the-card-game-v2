import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InitialPeekActions from './InitialPeekActions';
import PlayerTurnActions from './PlayerTurnActions';

/**
 * ActionBar serves as the main container and state orchestrator for the player's action area.
 * It is a "smart" component that determines which specific set of UI actions to display
 * based on the current state of the game. It renders different "action group" sub-components
 * (e.g., InitialPeekActions, PlayerTurnActions) which contain the actual UI for that state.
 */

// This will be expanded with many more props later.
interface ActionBarProps {
  isInitialSetupPhase: boolean;
  isPlayerTurn: boolean;
  
  // Props for InitialPeekActions
  showReadyForPeekButton: boolean;
  isWaitingForPeekConfirmation: boolean;
  peekableCards: any[] | null;
  showAcknowledgePeekButton: boolean;
  isWaitingForPostPeekGameState: boolean;
  onReadyForPeek: () => void;
  onAcknowledgePeek: () => void;

  // Props for PlayerTurnActions
  onDrawFromDeck: () => void;
  onDrawFromDiscard: () => void;
}

const ActionBar: React.FC<ActionBarProps> = (props) => {
  const { isInitialSetupPhase, isPlayerTurn } = props;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 bg-opacity-80 p-4 text-white shadow-lg backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between min-h-[60px]">
        <AnimatePresence mode="wait">
          {isInitialSetupPhase && (
            <motion.div
              key="initial-peek"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <InitialPeekActions {...props} />
            </motion.div>
          )}

          {isPlayerTurn && (
            <motion.div
              key="player-turn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <PlayerTurnActions {...props} />
            </motion.div>
          )}

          {/* 
            This is where other action groups will go. For example:
            ...
          */}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ActionBar; 