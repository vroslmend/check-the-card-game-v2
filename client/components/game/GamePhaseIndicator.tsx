'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { GameStage, PlayerActionType } from 'shared-types';
import { useUIActorRef, useUISelector, UIMachineSnapshot } from '@/context/GameUIContext';
import { Check } from 'lucide-react';
import logger from '@/lib/logger';

interface GamePhaseIndicatorProps {
  stage: GameStage;
  localPlayerId: string | null | undefined;
}

const selectIsLocalPlayerReady = (state: UIMachineSnapshot) => {
  if (!state.context.localPlayerId || !state.context.currentGameState) {
    return false;
  }
  return state.context.currentGameState.players[state.context.localPlayerId]?.isReady ?? false;
};

export function GamePhaseIndicator({ stage, localPlayerId }: GamePhaseIndicatorProps) {
  const { send } = useUIActorRef();
  const isLocalPlayerReady = useUISelector(selectIsLocalPlayerReady);

  // Determine if any player is still not ready during INITIAL_PEEK
  const shouldShowInitialPeekPrompt = useUISelector((state) => {
    if (stage !== GameStage.INITIAL_PEEK) return true; // not relevant
    const gs = state.context.currentGameState;
    if (!gs) return true;
    return Object.values(gs.players).some((p) => !p.isReady);
  });

  const handleReadyClick = () => {
    if (stage === GameStage.INITIAL_PEEK) {
      logger.info('Player clicked ready for peek');
      send({ type: PlayerActionType.DECLARE_READY_FOR_PEEK });
    }
  };

  const getStageContent = () => {
    switch (stage) {
      case GameStage.INITIAL_PEEK:
        return {
          title: 'Initial Peek',
          description: "Memorize your bottom two cards. They will be hidden shortly.",
          actionText: "I'm Ready",
          waitingText: "Waiting for other players...",
          showButton: true,
        };
      case GameStage.DEALING:
        return {
          title: 'Dealing Cards',
          description: 'The dealer is shuffling and dealing the cards.',
          showButton: false,
        };
      case GameStage.GAMEOVER:
        return {
            title: 'Game Over',
            description: 'The round has ended. Scores are being calculated.',
            showButton: false,
        }
      default:
        return null;
    }
  };

  const content = getStageContent();

  // Hide overlay during peek animation once everyone is ready
  if (stage === GameStage.INITIAL_PEEK && !shouldShowInitialPeekPrompt) {
    return null;
  }

  if (!content) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-md p-4"
      >
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-2xl shadow-2xl p-6 text-center border border-stone-200 dark:border-zinc-800">
          <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100 mb-2">{content.title}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
            {content.description}
          </p>
          {content.showButton && (
            <Button
              size="lg"
              className="w-full rounded-full font-semibold"
              onClick={handleReadyClick}
              disabled={isLocalPlayerReady}
              variant={isLocalPlayerReady ? 'secondary' : 'default'}
            >
              {isLocalPlayerReady ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {content.waitingText}
                </>
              ) : (
                content.actionText
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
} 