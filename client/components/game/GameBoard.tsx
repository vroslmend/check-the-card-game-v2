'use client';

import { WifiOff, Loader, AlertCircle } from 'lucide-react';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { TableArea } from './TableArea';
import PlayerHandStrip from './PlayerHandStrip';
import { type Card, TurnPhase, GameStage, PlayerActionType } from 'shared-types';
import { ActionController } from './ActionController';
import { isDrawnCard } from '@/lib/types';
import { GamePhaseIndicator } from './GamePhaseIndicator';
import { ActionControllerView } from './ActionControllerView';
import { AnimatePresence } from 'framer-motion';
import { GameEndScreen } from './GameEndScreen';
import { GameHeader } from './GameHeader';
import CardAnimationRoot from '@/components/cards/CardAnimationRoot';

const selectIsDisconnected = (state: UIMachineSnapshot) => state.matches({ inGame: 'disconnected' });
const selectIsReconnecting = (state: UIMachineSnapshot) => state.matches({ inGame: 'reconnecting' });
const selectLocalPlayerId = (state: UIMachineSnapshot) => state.context.localPlayerId;

const selectGameBoardProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gameState, localPlayerId } = state.context;
  const localPlayer = gameState && localPlayerId ? gameState.players[localPlayerId] : null;

  return {
    hasGameState: !!gameState,
    pendingDrawnCard: localPlayer?.pendingDrawnCard,
    isPlayerTurn: gameState?.currentPlayerId === localPlayerId,
    turnPhase: gameState?.turnPhase,
  };
};

const selectGameEndProps = (state: UIMachineSnapshot) => ({
  gameStage: state.context.currentGameState?.gameStage,
  players: Object.values(state.context.currentGameState?.players ?? {}),
  winnerId: state.context.currentGameState?.winnerId ?? null,
});

const ConnectionStatusBanner = () => {
  const isDisconnected = useUISelector(selectIsDisconnected);
  const isReconnecting = useUISelector(selectIsReconnecting);

  if (!isDisconnected && !isReconnecting) return null;

  return (
    <div className='absolute top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-50'>
      {isReconnecting ? 'Reconnecting...' : 'Connection Lost'}
    </div>
  );
};

const GameStateError = ({ hasPlayers, hasGameState }: { hasPlayers: boolean | undefined; hasGameState: boolean }) => {
  if (hasPlayers || !hasGameState) return null;

  return (
    <div className='absolute inset-0 flex items-center justify-center bg-black/50 z-50'>
      <div className='bg-white p-4 rounded-lg shadow-lg'>
        <h3 className='font-bold'>Game State Error</h3>
        <p>Could not load player data. Please refresh the page.</p>
      </div>
    </div>
  );
};

const LoadingIndicator = () => (
  <div className="flex items-center justify-center h-screen w-full bg-stone-50 dark:bg-zinc-950">
    <p className='font-serif text-stone-600 dark:text-stone-400'>Loading Game...</p>
  </div>
);


export function GameBoard() {
  const { send } = useUIActorRef();
  const localPlayerId = useUISelector(selectLocalPlayerId);
  const { hasGameState, pendingDrawnCard, isPlayerTurn, turnPhase } = useUISelector(selectGameBoardProps);
  const { gameStage, players, winnerId } = useUISelector(selectGameEndProps);

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
  const opponentPlayers = gameState && localPlayerId ? Object.values(gameState.players).filter((p) => p.id !== localPlayerId) : [];

  const handlePlayAgain = () => {
    send({ type: PlayerActionType.PLAY_AGAIN });
  };

  return (
    <div className="h-screen w-full bg-stone-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      <GameHeader />
      
      <div className="relative flex-1 flex flex-col">
        <AnimatePresence>
          {(gameStage === GameStage.GAMEOVER || gameStage === GameStage.SCORING) && (
            <GameEndScreen 
              players={players}
              winnerId={winnerId}
              localPlayerId={localPlayerId}
              onPlayAgain={handlePlayAgain}
            />
          )}
        </AnimatePresence>

        <ConnectionStatusBanner />
        <GamePhaseIndicator />
        <GameStateError hasPlayers={opponentPlayers.length > 0} hasGameState={hasGameState} />
        
        <CardAnimationRoot>
        <ActionController>
          <div className="h-full flex flex-col">
            {/* Opponents area */}
            <div className="flex-none flex justify-center items-center py-2">
              {opponentPlayers.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {opponentPlayers.map((op) => (
                    <PlayerHandStrip
                      key={op.id}
                      player={op}
                      isLocalPlayer={false}
                      isCurrentTurn={gameState?.currentPlayerId === op.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="font-serif text-stone-500 dark:text-stone-400">Waiting for opponents...</p>
              )}
            </div>

            {/* Table Area - takes up remaining space */}
            <div className="flex-1 flex items-center justify-center">
              <TableArea drawnCard={drawnCardData} />
            </div>

            {/* Local player area */}
            <div className="flex-none flex flex-col items-center py-2 pb-6">
              {localPlayerId && gameState ? (
                <PlayerHandStrip
                  player={gameState.players[localPlayerId]}
                  isLocalPlayer={true}
                  isCurrentTurn={isPlayerTurn}
                />
              ) : null}
              
              {/* Action bar */}
              <div className="mt-2 mb-4 h-16 flex items-center justify-center transition-all duration-300 ease-in-out">
                <ActionControllerView />
              </div>
            </div>
          </div>
        </ActionController>
        </CardAnimationRoot>
      </div>
    </div>
  );
}