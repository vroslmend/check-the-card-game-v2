'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TableArea } from './TableArea';
import { OpponentArea } from './OpponentArea';
import { LocalPlayerArea } from './LocalPlayerArea';
import { GameStage, type Card, TurnPhase } from 'shared-types';
import { GamePhaseIndicator } from './GamePhaseIndicator';
import { ActionController } from './ActionController';
import { isDrawnCard } from '@/lib/types';

const selectIsDisconnected = (state: UIMachineSnapshot) => state.matches({ inGame: 'disconnected' });
const selectIsReconnecting = (state: UIMachineSnapshot) => state.matches({ inGame: 'reconnecting' });
const selectLocalPlayerId = (state: UIMachineSnapshot) => state.context.localPlayerId;

const selectGameBoardProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gameState, localPlayerId } = state.context;
  const localPlayer = gameState && localPlayerId ? gameState.players[localPlayerId] : null;

  return {
    gameStage: gameState?.gameStage,
    hasPlayers: gameState && Object.keys(gameState.players).length > 0,
    hasGameState: !!gameState,
    pendingDrawnCard: localPlayer?.pendingDrawnCard,
    isPlayerTurn: gameState?.currentPlayerId === localPlayerId,
    turnPhase: gameState?.turnPhase,
  };
};

const ConnectionStatusBanner = () => {
  const { actorRef } = useContext(UIContext)!;
  const isDisconnected = useSelector(actorRef, selectIsDisconnected);
  const isReconnecting = useSelector(actorRef, selectIsReconnecting);

  return (
    <AnimatePresence>
      {(isDisconnected || isReconnecting) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 w-auto"
        >
          <Alert variant="destructive" className="py-2 px-4 rounded-lg shadow-lg bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {isReconnecting ? (
                <Loader className="h-4 w-4 animate-spin text-amber-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle className="mb-0 text-sm font-semibold text-stone-900 dark:text-stone-100">
                {isReconnecting ? 'Reconnecting...' : 'Connection Lost'}
              </AlertTitle>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const GameStateError = ({ hasPlayers, hasGameState }: { hasPlayers: boolean | undefined; hasGameState: boolean }) => (
  <AnimatePresence>
    {!hasPlayers && hasGameState && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-40"
      >
        <Alert variant="destructive" className="max-w-md shadow-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Game State Error</AlertTitle>
          <AlertDescription>
            Could not load player data. The game state may be corrupted. Please refresh the page.
          </AlertDescription>
        </Alert>
      </motion.div>
    )}
  </AnimatePresence>
);

const LoadingIndicator = () => (
  <div className="flex items-center justify-center min-h-screen w-full bg-stone-50 dark:bg-zinc-950">
    <div className="flex flex-col items-center font-serif text-stone-600 dark:text-stone-400">
      <Loader className="h-8 w-8 animate-spin mb-4" />
      <p>Loading Game...</p>
    </div>
  </div>
);


export function GameBoard() {
  const { actorRef } = useContext(UIContext)!;
  const localPlayerId = useSelector(actorRef, selectLocalPlayerId);
  const {
    gameStage,
    hasPlayers,
    hasGameState,
    pendingDrawnCard,
    isPlayerTurn,
    turnPhase,
  } = useSelector(actorRef, selectGameBoardProps);

  if (!localPlayerId || !hasGameState) {
    return <LoadingIndicator />;
  }

  const drawnCardData = 
    isPlayerTurn &&
    turnPhase === TurnPhase.DISCARD &&
    isDrawnCard(pendingDrawnCard)
    ? pendingDrawnCard.card
    : undefined;

  return (
    <LayoutGroup>
      <div className="h-screen w-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="relative w-full h-full max-w-7xl max-h-[calc(100vh-2rem)] aspect-[16/10] bg-stone-100 dark:bg-zinc-900 rounded-lg shadow-2xl overflow-hidden">
        
          <ConnectionStatusBanner />
          <GameStateError hasPlayers={hasPlayers} hasGameState={hasGameState} />
          
          {gameStage && <GamePhaseIndicator stage={gameStage} localPlayerId={localPlayerId} />}
          
          <ActionController>
            <div className="grid grid-rows-[2fr,3fr,3fr] h-full p-1 sm:p-2 md:p-4 gap-1 sm:gap-2 md:gap-4 min-h-0">
              {/* Opponent Area */}
              <div className="min-h-0">
                <OpponentArea />
              </div>
              
              {/* Table Area */}
              <div className="min-h-0">
                <TableArea drawnCard={drawnCardData} />
              </div>
              
              {/* Local Player Area */}
              <div className="min-h-0">
                <LocalPlayerArea />
              </div>
            </div>
          </ActionController>
        </div>
      </div>
    </LayoutGroup>
  );
}