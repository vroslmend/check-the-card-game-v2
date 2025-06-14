'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { TableArea } from './TableArea';
import PlayerHandStrip from './PlayerHandStrip';
import { type Card, TurnPhase } from 'shared-types';
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
  const isDisconnected = useUISelector(selectIsDisconnected);
  const isReconnecting = useUISelector(selectIsReconnecting);

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
  const localPlayerId = useUISelector(selectLocalPlayerId);
  const {
    hasPlayers,
    hasGameState,
    pendingDrawnCard,
    isPlayerTurn,
    turnPhase,
  } = useUISelector(selectGameBoardProps);

  if (!localPlayerId || !hasGameState) {
    return <LoadingIndicator />;
  }

  const drawnCardData =
    isPlayerTurn &&
    turnPhase === TurnPhase.DISCARD &&
    isDrawnCard(pendingDrawnCard)
      ? pendingDrawnCard.card
      : undefined;

  const gameState = useUISelector((state) => state.context.currentGameState);
  const abilityContext = useUISelector((state) => state.context.currentAbilityContext);
  const opponentPlayers = gameState && localPlayerId ? Object.values(gameState.players).filter((p) => p.id !== localPlayerId) : [];

  return (
    <div className="relative w-full md:max-w-7xl glass rounded-none md:rounded-[2.5rem] shadow-xl md:shadow-2xl border-t md:border md:border-stone-200 dark:md:border-zinc-800 pb-32 md:pb-10 mt-24 md:mt-28 max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-visible">
    
      <ConnectionStatusBanner />
      <GameStateError hasPlayers={hasPlayers} hasGameState={hasGameState} />
      
      <ActionController>
        <div
          className="flex flex-col md:grid h-full p-1 sm:p-3 md:p-6 gap-2 sm:gap-4 md:gap-8 min-h-0"
          style={{ gridTemplateRows: 'auto minmax(140px,1fr) auto' }}
        >
          {/* Opponents */}
          <div className="min-h-0 flex items-center justify-center overflow-x-auto">
            {opponentPlayers && opponentPlayers.length > 0 ? (
              <div className="flex flex-row items-center justify-center gap-4 h-full w-full">
                {opponentPlayers.map((op) => (
                  <PlayerHandStrip
                    key={op.id}
                    player={op}
                    isLocalPlayer={false}
                    isCurrentTurn={gameState?.currentPlayerId === op.id}
                    isTargetable={!!abilityContext && !op.isLocked}
                    abilityContext={abilityContext}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-stone-50 dark:bg-zinc-800/50 shadow-inner">
                <p className="font-serif text-stone-500">Waiting for opponents...</p>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1">
            <TableArea drawnCard={drawnCardData} />
          </div>

          {/* Local player */}
          <div className="min-h-0 flex items-center justify-center overflow-x-auto pb-2">
            {localPlayerId && gameState ? (
              <PlayerHandStrip
                player={gameState.players[localPlayerId]}
                isLocalPlayer={true}
                isCurrentTurn={isPlayerTurn}
                isTargetable={false}
                abilityContext={abilityContext}
              />
            ) : null}
          </div>
        </div>
      </ActionController>
    </div>
  );
}