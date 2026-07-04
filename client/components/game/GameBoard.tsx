"use client";

import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { TableArea } from "./TableArea";
import PlayerHandStrip from "./PlayerHandStrip";
import { GameStage, PlayerActionType, type PublicCard } from "shared-types";
import { ActionController } from "./ActionController";
import { ActionControllerView } from "./ActionControllerView";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GameEndScreen } from "./GameEndScreen";
import { GameHeader } from "./GameHeader";
import SidePanel from "@/components/layout/SidePanel";
import { useCheckMoment, CheckStamp } from "./CheckMoment";

const selectIsDisconnected = (state: UIMachineSnapshot) =>
  state.matches({ inGame: "disconnected" });
const selectIsReconnecting = (state: UIMachineSnapshot) =>
  state.matches({ inGame: "reconnecting" });

const selectGameBoardProps = (state: UIMachineSnapshot) => {
  const { currentGameState: gameState, localPlayerId } = state.context;
  const playerWithPendingCard = Object.values(gameState?.players ?? {}).find(
    (p) => p.pendingDrawnCard,
  );

  return {
    gameState: gameState,
    localPlayerId: localPlayerId,
    playerWithPendingCard: playerWithPendingCard,
    isMyTurn: gameState?.currentPlayerId === localPlayerId,
  };
};

const selectGameEndProps = (state: UIMachineSnapshot) => {
  const gameState = state.context.currentGameState;
  const fallbackWinner = gameState?.winnerId ? [gameState.winnerId] : [];
  return {
    gameStage: gameState?.gameStage,
    players: Object.values(gameState?.players ?? {}),
    winnerIds: gameState?.gameover?.winnerIds ?? fallbackWinner,
  };
};

const ConnectionStatusBanner = () => {
  const isDisconnected = useUISelector(selectIsDisconnected);
  const isReconnecting = useUISelector(selectIsReconnecting);
  if (!isDisconnected && !isReconnecting) return null;
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-4 py-2 rounded-pill z-50">
      {isReconnecting ? "Reconnecting..." : "Connection Lost"}
    </div>
  );
};

const GameStateError = ({
  hasPlayers,
  hasGameState,
}: {
  hasPlayers: boolean | undefined;
  hasGameState: boolean;
}) => {
  if (hasPlayers || !hasGameState) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/50 z-50">
      <div className="bg-surface text-ink p-4 rounded-card border border-hairline shadow-lg">
        <h3 className="font-bold">Game State Error</h3>
        <p className="text-ink-muted">
          Could not load player data. Please refresh the page.
        </p>
      </div>
    </div>
  );
};

const LoadingIndicator = () => (
  <div className="flex items-center justify-center h-screen w-full bg-ground">
    <p className="font-game text-ink-muted">Loading Game...</p>
  </div>
);

export function GameBoard() {
  const { send } = useUIActorRef();
  const { gameState, localPlayerId, playerWithPendingCard, isMyTurn } =
    useUISelector(selectGameBoardProps);
  const { gameStage, players, winnerIds } = useUISelector(selectGameEndProps);
  const checkMoment = useCheckMoment();
  const reducedMotion = useReducedMotion();

  if (!localPlayerId || !gameState) {
    return <LoadingIndicator />;
  }

  const isDealing = gameState.gameStage === GameStage.DEALING;

  const dealingDeck: PublicCard[] = isDealing
    ? Object.values(gameState.players).flatMap((p) =>
        p.hand.map((card) => ({ id: card.id, facedown: true as const })),
      )
    : [];

  const drawnCardData = playerWithPendingCard?.pendingDrawnCard?.card;

  const opponentPlayers = Object.values(gameState.players).filter(
    (p) => p.id !== localPlayerId,
  );

  const handlePlayAgain = () => {
    send({ type: PlayerActionType.PLAY_AGAIN });
  };

  return (
    <div className="relative h-screen w-full bg-ground flex flex-col overflow-hidden @container font-game">
      <GameHeader />
      <motion.div
        className="relative flex-1 grid grid-rows-[auto_1fr_auto_auto]"
        animate={{ scale: checkMoment && !reducedMotion ? 0.92 : 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ transformOrigin: "center" }}
      >
        <AnimatePresence>
          {(gameStage === GameStage.GAMEOVER ||
            gameStage === GameStage.SCORING) && (
            <GameEndScreen
              players={players}
              winnerIds={winnerIds}
              localPlayerId={localPlayerId}
              onPlayAgain={handlePlayAgain}
            />
          )}
        </AnimatePresence>

        <ConnectionStatusBanner />
        <SidePanel />
        <GameStateError
          hasPlayers={opponentPlayers.length > 0}
          hasGameState={!!gameState}
        />

        <ActionController>
          <div className="contents">
            {/* Opponents area */}
            <div className="flex justify-center items-center py-2">
              {opponentPlayers.length > 0 ? (
                <div className="w-full flex flex-wrap justify-evenly gap-2">
                  {opponentPlayers.map((op) => (
                    <PlayerHandStrip
                      key={op.id}
                      player={{
                        ...op,
                        hand: isDealing ? [] : op.hand,
                      }}
                      isLocalPlayer={false}
                      isCurrentTurn={gameState.currentPlayerId === op.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="font-game text-ink-muted">
                  Waiting for opponents...
                </p>
              )}
            </div>

            {/* Table Area - takes up remaining space */}
            <div className="flex items-center justify-center @container">
              <TableArea
                drawnCard={drawnCardData}
                drawnByName={
                  playerWithPendingCard &&
                  playerWithPendingCard.id !== localPlayerId
                    ? playerWithPendingCard.name
                    : undefined
                }
                dealingDeck={dealingDeck}
              />
            </div>

            {/* Local player area */}
            <div className="flex flex-col items-center justify-center py-2">
              {localPlayerId && gameState.players[localPlayerId] ? (
                <PlayerHandStrip
                  player={{
                    ...gameState.players[localPlayerId],
                    hand: isDealing
                      ? []
                      : gameState.players[localPlayerId].hand,
                  }}
                  isLocalPlayer={true}
                  isCurrentTurn={isMyTurn}
                />
              ) : null}
            </div>
            {/* Action bar */}
            <div className="min-h-16 flex items-center justify-center transition-all duration-300 ease-in-out pb-4">
              <ActionControllerView />
            </div>
          </div>
        </ActionController>
      </motion.div>

      <CheckStamp moment={checkMoment} />
    </div>
  );
}
