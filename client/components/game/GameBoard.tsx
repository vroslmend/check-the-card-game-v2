'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TableArea } from './TableArea';
import { OpponentArea } from './OpponentArea';
import { LocalPlayerArea } from './LocalPlayerArea';
import { GameStage, type Card, TurnPhase } from 'shared-types';
import { DrawnCardArea } from './DrawnCardArea';
import { GamePhaseIndicator } from './GamePhaseIndicator';

const selectGameBoardProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gameState, localPlayerId } = state.context;
  const isDisconnected = state.matches({ inGame: 'disconnected' });
  const isReconnecting = state.matches({ inGame: 'reconnecting' });
  const gameStage = gameState?.gameStage;
  const localPlayer = gameState && localPlayerId ? gameState.players[localPlayerId] : null;

  return {
    isDisconnected,
    isReconnecting,
    gameStage,
    localPlayerId,
    hasPlayers: gameState && Object.keys(gameState.players).length > 0,
    hasGameState: !!gameState,
    pendingDrawnCard: localPlayer?.pendingDrawnCard,
    isPlayerTurn: gameState?.currentPlayerId === localPlayerId,
    turnPhase: gameState?.turnPhase,
  };
};

function isDrawnCard(card: unknown): card is { card: Card; source: 'deck' | 'discard' } {
  return card !== null && typeof card === 'object' && 'card' in card && 'source' in card;
}

export function GameBoard() {
  const { actorRef } = useContext(UIContext)!;
  const {
    isDisconnected,
    isReconnecting,
    gameStage,
    localPlayerId,
    hasPlayers,
    hasGameState,
    pendingDrawnCard,
    isPlayerTurn,
    turnPhase,
  } = useSelector(actorRef, selectGameBoardProps);

  if (!hasGameState || !localPlayerId) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-stone-100 dark:bg-zinc-950">
        <div className="flex flex-col items-center font-serif text-stone-600 dark:text-stone-400">
          <Loader className="h-8 w-8 animate-spin mb-4" />
          <p>Loading Game...</p>
        </div>
      </div>
    );
  }

  const handleChooseSwapTarget = () => {
    actorRef.send({ type: 'CHOOSE_SWAP_TARGET' });
  };

  const handleDiscard = () => {
    actorRef.send({ type: 'DISCARD_DRAWN_CARD' });
  };

  const showDrawnCardArea =
    isDrawnCard(pendingDrawnCard) && isPlayerTurn && turnPhase === TurnPhase.DISCARD;

  return (
    <div className="relative h-screen w-full flex flex-col bg-stone-100 dark:bg-zinc-900 font-serif">
      <AnimatePresence>
        {(isDisconnected || isReconnecting) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
          >
            <Alert
              variant="destructive"
              className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-2xl shadow-2xl border-stone-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                {isReconnecting ? (
                  <Loader className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <AlertTitle className="text-stone-900 dark:text-stone-100">
                  {isReconnecting ? 'Reconnecting...' : 'Connection Lost'}
                </AlertTitle>
              </div>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!hasPlayers && hasGameState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-40"
          >
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Game State Error</AlertTitle>
              <AlertDescription>
                Could not load player data. Please refresh the page.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawn Card Overlay */}
      {showDrawnCardArea && isDrawnCard(pendingDrawnCard) && (
        <DrawnCardArea
          card={pendingDrawnCard.card}
          onSwap={handleChooseSwapTarget}
          onDiscard={handleDiscard}
          canDiscard={pendingDrawnCard.source === 'deck'}
        />
      )}

      {/* Game Phase Banners */}
      {gameStage && <GamePhaseIndicator stage={gameStage} localPlayerId={localPlayerId} />}

      {/* Player-centric Cockpit Layout */}
      <div className="flex-shrink-0 p-4">
        <OpponentArea />
      </div>

      <div className="flex-grow my-4 flex items-center justify-center p-4">
        <TableArea />
      </div>

      <div className="flex-shrink-0 p-4">
        <LocalPlayerArea />
      </div>
    </div>
  );
}